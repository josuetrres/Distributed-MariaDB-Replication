package com.banco.acid.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.ResultSetMetaData;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReplicacionService {

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    @Value("${node.db.replica-host:localhost}")
    private String replicaHost;

    @Value("${spring.datasource.username:banco_user}")
    private String dbUser;

    @Value("${spring.datasource.password:banco_pass_segura}")
    private String dbPassword;

    @Value("${DB_PORT:3306}")
    private String dbPort;

    @Value("${DB_NAME:banco_acid_db}")
    private String dbName;

    public Map<String, Object> obtenerEstadoReplicacionLocal() {
        Map<String, Object> info = new HashMap<>();
        info.put("nodoApi", nombreNodo);
        info.put("dbHost", replicaHost);

        String jdbcUrl = "jdbc:mariadb://" + replicaHost + ":" + dbPort + "/" + dbName + "?connectTimeout=3000";

        try (Connection conn = DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
             Statement stmt = conn.createStatement()) {

            info.put("estadoConexion", "CONECTADO A BD LOCAL / RÉPLICA");

            // 1. Variables de Sistema
            info.put("hostnameDb", consultarSql(stmt, "SELECT @@hostname", "localhost"));
            info.put("serverId", consultarSql(stmt, "SELECT @@server_id", "1"));
            String readOnlyVal = consultarSql(stmt, "SELECT @@read_only", "0");
            info.put("readOnly", readOnlyVal);
            info.put("role", "1".equals(readOnlyVal) ? "RÉPLICA (Solo Lectura)" : "MASTER (Lectura / Escritura)");
            info.put("gtidPos", consultarSql(stmt, "SELECT @@gtid_current_pos", "N/A"));

            // 2. Verificación de Lectura en Tiempo Real desde esta instancia específica (Master o Réplica)
            try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*), SUM(saldo) FROM cuentas")) {
                if (rs.next()) {
                    info.put("totalCuentas", rs.getString(1) != null ? rs.getString(1) : "0");
                    info.put("sumaSaldos", rs.getString(2) != null ? rs.getString(2) : "0.00");
                }
            } catch (Exception e) {
                info.put("totalCuentas", "Error lectura");
                info.put("sumaSaldos", "Error lectura");
            }

            // 3. Estado de Esclavo / Réplica (SHOW SLAVE STATUS / SHOW REPLICA STATUS)
            boolean esReplica = false;
            try (ResultSet rs = stmt.executeQuery("SHOW SLAVE STATUS")) {
                if (rs.next()) {
                    esReplica = true;
                    ResultSetMetaData meta = rs.getMetaData();
                    int colCount = meta.getColumnCount();
                    Map<String, String> slaveCols = new HashMap<>();
                    for (int i = 1; i <= colCount; i++) {
                        slaveCols.put(meta.getColumnLabel(i).toLowerCase(), rs.getString(i));
                    }

                    info.put("slaveIoRunning", slaveCols.getOrDefault("slave_io_running", "Yes"));
                    info.put("slaveSqlRunning", slaveCols.getOrDefault("slave_sql_running", "Yes"));
                    info.put("secondsBehindMaster", slaveCols.getOrDefault("seconds_behind_master", "0"));
                    info.put("masterHostConectado", slaveCols.getOrDefault("master_host", "192.168.1.93"));
                    info.put("lastError", slaveCols.getOrDefault("last_error", "Ninguno"));
                }
            } catch (Exception e) {
                log.warn("SHOW SLAVE STATUS falló o retornó vacío: {}", e.getMessage());
            }

            if (!esReplica) {
                info.put("slaveIoRunning", "N/A (Es Master)");
                info.put("slaveSqlRunning", "N/A (Es Master)");
                info.put("secondsBehindMaster", "0 ms (Master)");
                info.put("masterHostConectado", "N/A (Local es Master)");
                info.put("lastError", "Ninguno");
            }

        } catch (Exception e) {
            log.error("Error conectando a la BD local/replica {}: {}", jdbcUrl, e.getMessage());
            info.put("estadoConexion", "ERROR: " + e.getMessage());
            info.put("hostnameDb", "Desconectado");
            info.put("serverId", "N/A");
            info.put("readOnly", "N/A");
            info.put("role", "DESCONECTADO");
            info.put("gtidPos", "N/A");
            info.put("totalCuentas", "0");
            info.put("sumaSaldos", "0.00");
            info.put("slaveIoRunning", "Inactivo");
            info.put("slaveSqlRunning", "Inactivo");
            info.put("secondsBehindMaster", "N/A");
            info.put("masterHostConectado", "N/A");
        }

        return info;
    }

    public Map<String, Object> consultarDatosLocalesDb() {
        Map<String, Object> result = new HashMap<>();
        result.put("nodoConsulta", nombreNodo);
        result.put("instanciaBaseDatos", replicaHost + " (Puerto " + dbPort + ")");
        result.put("timestampConsulta", java.time.ZonedDateTime.now().toString());

        String jdbcUrl = "jdbc:mariadb://" + replicaHost + ":" + dbPort + "/" + dbName + "?connectTimeout=3000";

        try (Connection conn = DriverManager.getConnection(jdbcUrl, dbUser, dbPassword);
             Statement stmt = conn.createStatement()) {

            Map<String, String> serverInfo = new HashMap<>();
            serverInfo.put("hostname", consultarSql(stmt, "SELECT @@hostname", "localhost"));
            serverInfo.put("serverId", consultarSql(stmt, "SELECT @@server_id", "1"));
            String readOnlyVal = consultarSql(stmt, "SELECT @@read_only", "0");
            serverInfo.put("readOnly", readOnlyVal);
            serverInfo.put("role", "1".equals(readOnlyVal) ? "RÉPLICA (Solo Lectura)" : "MASTER (Lectura / Escritura)");
            serverInfo.put("gtidCurrentPos", consultarSql(stmt, "SELECT @@gtid_current_pos", "N/A"));
            result.put("servidorMariaDB", serverInfo);

            Map<String, Object> tablas = new HashMap<>();

            // 1. Cuentas
            java.util.List<Map<String, Object>> cuentas = new java.util.ArrayList<>();
            try (ResultSet rs = stmt.executeQuery("SELECT id, numero_cuenta, titular, saldo FROM cuentas ORDER BY id ASC")) {
                while (rs.next()) {
                    Map<String, Object> fila = new HashMap<>();
                    fila.put("id", rs.getLong("id"));
                    fila.put("numeroCuenta", rs.getString("numero_cuenta"));
                    fila.put("titular", rs.getString("titular"));
                    fila.put("saldo", rs.getBigDecimal("saldo"));
                    cuentas.add(fila);
                }
            }
            tablas.put("1_tabla_cuentas", cuentas);

            // 2. Transacciones (últimas 5)
            java.util.List<Map<String, Object>> transacciones = new java.util.ArrayList<>();
            try (ResultSet rs = stmt.executeQuery("SELECT id, tx_guid, cuenta_origen_id, cuenta_destino_id, monto, estado, nodo_ejecutor FROM transacciones ORDER BY id DESC LIMIT 5")) {
                while (rs.next()) {
                    Map<String, Object> fila = new HashMap<>();
                    fila.put("id", rs.getLong("id"));
                    fila.put("guid", rs.getString("tx_guid"));
                    fila.put("origenId", rs.getLong("cuenta_origen_id"));
                    fila.put("destinoId", rs.getLong("cuenta_destino_id"));
                    fila.put("monto", rs.getBigDecimal("monto"));
                    fila.put("estado", rs.getString("estado"));
                    fila.put("nodo", rs.getString("nodo_ejecutor"));
                    transacciones.add(fila);
                }
            }
            tablas.put("2_ultimas_transacciones", transacciones);

            // 3. Bitacora WAL (últimas 5)
            java.util.List<Map<String, Object>> bitacora = new java.util.ArrayList<>();
            try (ResultSet rs = stmt.executeQuery("SELECT id, tx_guid, fase_wal, detalles FROM bitacora_wal ORDER BY id DESC LIMIT 5")) {
                while (rs.next()) {
                    Map<String, Object> fila = new HashMap<>();
                    fila.put("id", rs.getLong("id"));
                    fila.put("guid", rs.getString("tx_guid"));
                    fila.put("faseWal", rs.getString("fase_wal"));
                    fila.put("detalles", rs.getString("detalles"));
                    bitacora.add(fila);
                }
            }
            tablas.put("3_bitacora_wal", bitacora);

            result.put("datosAlmacenadosEnBdLocal", tablas);

        } catch (Exception e) {
            log.error("Error leyendo tablas en BD {}: {}", jdbcUrl, e.getMessage());
            result.put("errorConexion", e.getMessage());
        }

        return result;
    }

    private String consultarSql(Statement stmt, String sql, String defaultVal) {
        try (ResultSet rs = stmt.executeQuery(sql)) {
            if (rs.next() && rs.getString(1) != null) {
                return rs.getString(1);
            }
        } catch (Exception e) {
            log.debug("No se pudo ejecutar {}: {}", sql, e.getMessage());
        }
        return defaultVal;
    }
}
