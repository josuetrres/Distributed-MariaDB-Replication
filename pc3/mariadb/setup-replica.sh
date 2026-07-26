#!/bin/bash
set -e

configure_replication() {
    echo "=== [Segundo Plano] Esperando que MariaDB local acepte conexiones... ==="
    until mariadb-admin ping -h localhost -u root -p"${DB_ROOT_PASSWORD}" --silent; do
        sleep 2
    done

    echo "=== [Segundo Plano] Esperando disponibilidad del Master MariaDB en ${MASTER_HOST}:3306 ==="
    until mariadb-admin ping -h"${MASTER_HOST}" -u"${DB_USER}" -p"${DB_PASSWORD}" --silent; do
        sleep 3
    done

    echo "=== [Segundo Plano] Conectado al Master. Configurando Replicación GTID ==="
    mariadb -h localhost -u root -p"${DB_ROOT_PASSWORD}" <<EOF
STOP REPLICA;
SET GLOBAL gtid_slave_pos = "";
CHANGE REPLICATION SOURCE TO
  MASTER_HOST='${MASTER_HOST}',
  MASTER_PORT=3306,
  MASTER_USER='${REPL_USER}',
  MASTER_PASSWORD='${REPL_PASSWORD}',
  MASTER_USE_GTID=slave_pos,
  MASTER_CONNECT_RETRY=10;
START REPLICA;
SHOW REPLICA STATUS\G
EOF
    echo "=== [Segundo Plano] Replicación GTID configurada correctamente en PC3 (Replica 2) ==="
}

configure_replication &

