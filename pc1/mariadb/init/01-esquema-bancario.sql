-- Esquema Inicial para el Sistema de Transacciones Bancarias ACID
CREATE DATABASE IF NOT EXISTS banco_acid_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE banco_acid_db;

-- 1. Tabla de Cuentas Bancarias
CREATE TABLE IF NOT EXISTS cuentas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    numero_cuenta VARCHAR(20) NOT NULL UNIQUE,
    titular VARCHAR(100) NOT NULL,
    saldo DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(5) NOT NULL DEFAULT 'USD',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_saldo_positivo CHECK (saldo >= 0.00)
) ENGINE=InnoDB;

-- 2. Tabla de Transacciones Registradas
CREATE TABLE IF NOT EXISTS transacciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tx_guid VARCHAR(64) NOT NULL UNIQUE,
    cuenta_origen_id INT NOT NULL,
    cuenta_destino_id INT NOT NULL,
    monto DECIMAL(15, 2) NOT NULL,
    estado VARCHAR(20) NOT NULL, -- PENDIENTE, COMPLETADA, REVERTIDA, FALLIDA
    nivel_aislamiento VARCHAR(30) DEFAULT 'READ_COMMITTED',
    error_simulado BOOLEAN DEFAULT FALSE,
    nodo_ejecutor VARCHAR(50) NOT NULL,
    mensaje VARCHAR(255),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cuenta_origen_id) REFERENCES cuentas(id),
    FOREIGN KEY (cuenta_destino_id) REFERENCES cuentas(id)
) ENGINE=InnoDB;

-- 3. Bitácora de Registro Previo (Write-Ahead Logging a nivel de Aplicación / Auditoría WAL)
CREATE TABLE IF NOT EXISTS bitacora_wal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tx_guid VARCHAR(64) NOT NULL,
    fase_wal VARCHAR(30) NOT NULL, -- INICIADA, WAL_GRABADO_BUFFER, REDO_PREPARADO, UNDO_REGISTRADO, COMMIT_FLUSH, ROLLBACK_EJECUTADO
    cuenta_origen_id INT,
    cuenta_destino_id INT,
    monto DECIMAL(15, 2),
    saldo_origen_anterior DECIMAL(15, 2),
    saldo_origen_nuevo DECIMAL(15, 2),
    saldo_destino_anterior DECIMAL(15, 2),
    saldo_destino_nuevo DECIMAL(15, 2),
    detalles VARCHAR(255),
    fecha_log TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Sembrado de Datos Iniciales de Cuentas Bancarias
INSERT INTO cuentas (numero_cuenta, titular, saldo, moneda) VALUES
('CTA-1001', 'Carlos Mendoza (Cliente A)', 10000.00, 'USD'),
('CTA-1002', 'Ana Sofía Rodríguez (Cliente B)', 5000.00, 'USD'),
('CTA-1003', 'Empresa Inversiones Globales S.A.', 50000.00, 'USD'),
('CTA-1004', 'Fondo de Reserva Bancario', 100000.00, 'USD')
ON DUPLICATE KEY UPDATE id=id;

-- Configuración del usuario de Replicación MariaDB GTID
-- Permite conexiones desde cualquier IP de la LAN para PC2 y PC3
CREATE USER IF NOT EXISTS 'repl_user'@'%' IDENTIFIED BY 'repl_pass_segura';
GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'repl_user'@'%';
FLUSH PRIVILEGES;
