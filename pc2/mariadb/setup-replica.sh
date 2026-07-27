#!/bin/bash
set -e

configure_replication() {
    echo "=== [Segundo Plano] Esperando que MariaDB local acepte conexiones... ==="
    until mariadb-admin ping -h 127.0.0.1 -u root -p"${MARIADB_ROOT_PASSWORD}" --silent; do
        sleep 2
    done
    echo "=== [Segundo Plano] MariaDB local está activa. ==="

    echo "=== [Segundo Plano] Esperando disponibilidad del Master MariaDB en ${MASTER_HOST}:3306 ==="
    until mariadb-admin ping -h"${MASTER_HOST}" -u"${MARIADB_USER}" -p"${MARIADB_PASSWORD}" --silent; do
        echo "=== [Segundo Plano] El Master en ${MASTER_HOST}:3306 no está listo. Reintentando en 3 segundos... ==="
        sleep 3
    done
    echo "=== [Segundo Plano] Master MariaDB está activo y responde. ==="

    echo "=== [Segundo Plano] Conectando al Master. Configurando Replicación GTID ==="
    until mariadb -h 127.0.0.1 -u root -p"${MARIADB_ROOT_PASSWORD}" <<EOF
STOP SLAVE;
SET GLOBAL gtid_slave_pos = "";
CHANGE MASTER TO
  MASTER_HOST='${MASTER_HOST}',
  MASTER_PORT=3306,
  MASTER_USER='${REPL_USER}',
  MASTER_PASSWORD='${REPL_PASSWORD}',
  MASTER_USE_GTID=slave_pos,
  MASTER_CONNECT_RETRY=10;
GRANT REPLICATION CLIENT, SLAVE MONITOR, PROCESS ON *.* TO '${MARIADB_USER}'@'%';
FLUSH PRIVILEGES;
START SLAVE;
SHOW SLAVE STATUS\G
EOF
    do
        echo "=== [Segundo Plano] Error al configurar la replicación en el servidor local. Reintentando en 3 segundos... ==="
        sleep 3
    done

    echo "=== [Segundo Plano] Replicación GTID configurada correctamente en PC2 (Replica 1) ==="
}

configure_replication &
