#!/bin/bash
set -e

echo "=== Esperando disponibilidad del Master MariaDB en ${MASTER_HOST}:3306 ==="
until mariadb-admin ping -h"${MASTER_HOST}" -u"${DB_USER}" -p"${DB_PASSWORD}" --silent; do
    echo "Master no disponible aún... reintentando en 3 segundos..."
    sleep 3
done

echo "=== Conectado exitosamente al Master. Configurando Replicación GTID ==="
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

echo "=== Replicación GTID configurada correctamente en PC3 (Replica 2) ==="
