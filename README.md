# 🏛️ Sistema Distribuido de Transacciones Bancarias ACID con MariaDB WAL & Replicación GTID

Este proyecto demuestra la implementación de un sistema distribuido de transacciones bancarias diseñado para ejecutarse en **3 dispositivos físicos (PC1, PC2 y PC3)** sobre una Red de Área Local (LAN).

El objetivo técnico principal es evaluar las propiedades **ACID** (especialmente **Atomicidad** y **Durabilidad**), el funcionamiento del mecanismo **Write-Ahead Logging (WAL)** a nivel de motor InnoDB (`innodb_flush_log_at_trx_commit=1`) y a nivel de aplicación, la recuperación automática mediante **REDO y UNDO**, y la **replicación Master-Replica por GTID** en MariaDB.

---

## 📐 Arquitectura de Nodos y Servicios

```
PC1 (Master Node)                PC2 (Replica 1 Node)             PC3 (Replica 2 Node)
├── Frontend (HTML5/CSS/JS)      ├── API2 (Spring Boot 8082)      ├── API3 (Spring Boot 8083)
├── Nginx Proxy (Puerto 80)      └── MariaDB Replica 1 (3306)     └── MariaDB Replica 2 (3306)
├── API1 (Spring Boot 8081)
├── MariaDB Master (3306)
└── Adminer (Puerto 8080)
```

---

## 🚀 Guía de Despliegue Paso a Paso

### 1. Configuración Inicial del Archivo `.env`
En el equipo PC1 (o en cada equipo), copia el archivo `.env.example` a `.env` y configura las direcciones IP LAN reales asignadas a cada máquina:

```bash
cp .env.example .env
```

Edita `.env` con las IPs de tu red (ejemplo):
```env
PC1_IP=192.168.1.10
PC2_IP=192.168.1.11
PC3_IP=192.168.1.12
```

---

### 2. Ejecución en PC1 (Nodo Principal / Master)
Transfiere la carpeta del proyecto a **PC1** y ejecuta:

```bash
docker compose -f docker-compose.pc1.yml --env-file .env up -d --build
```

Servicios desplegados en PC1:
- **Frontend Dashboard**: Acceso por navegador web en `http://<IP_PC1>/` (Puerto 80).
- **API 1 (Spring Boot)**: Escuchando en `http://<IP_PC1>:8081`.
- **MariaDB Master**: Puerto 3306 (GTID y Write-Ahead Logging habilitado).
- **Adminer SQL GUI**: Acceso en `http://<IP_PC1>:8080`.

---

### 3. Ejecución en PC2 (Nodo Replica 1)
En el equipo **PC2**, clona o copia la carpeta del proyecto y ejecuta:

```bash
docker compose -f docker-compose.pc2.yml --env-file .env up -d --build
```

Servicios desplegados en PC2:
- **MariaDB Replica 1**: Se conecta automáticamente por GTID al Master en `${PC1_IP}:3306`.
- **API 2 (Spring Boot)**: Escuchando en `http://<IP_PC2>:8082` (Escrituras dirigidas al Master, lecturas en Replica 1).

---

### 4. Ejecución en PC3 (Nodo Replica 2)
En el equipo **PC3**, clona o copia la carpeta del proyecto y ejecuta:

```bash
docker compose -f docker-compose.pc3.yml --env-file .env up -d --build
```

Servicios desplegados en PC3:
- **MariaDB Replica 2**: Se conecta automáticamente por GTID al Master en `${PC1_IP}:3306`.
- **API 3 (Spring Boot)**: Escuchando en `http://<IP_PC3>:8083` (Escrituras dirigidas al Master, lecturas en Replica 2).

---

## 🧪 Guía de Pruebas y Evaluación ACID

### 1. Prueba del Proceso UNDO (Rollback por Excepción)
1. Abre el Dashboard en `http://<IP_PC1>/`.
2. Selecciona la Cuenta Origen (`CTA-1001`) y la Cuenta Destino (`CTA-1002`).
3. Activa la casilla **"⚠️ Simular Falla / Excepción Repentina"**.
4. Haz clic en **"Ejecutar Transacción Bancaria"**.
5. **Resultado esperado**: La aplicación lanzará una excepción provocada. El motor MariaDB y Spring Boot ejecutarán el proceso **UNDO (Rollback)**. En la **Bitácora WAL** se registrará la fase `ROLLBACK_EJECUTADO` y los saldos no sufrirán modificaciones.

### 2. Prueba del Proceso REDO y Crash Recovery (`docker kill`)
1. Inicia una serie de transferencias o simulación de carga.
2. Simula una caída repentina de energía en PC1 ejecutando:
   ```bash
   docker kill mariadb-master-pc1
   ```
3. Inicia nuevamente el contenedor:
   ```bash
   docker compose -f docker-compose.pc1.yml up -d mariadb-master
   ```
4. Inspecciona los logs del motor InnoDB:
   ```bash
   docker logs mariadb-master-pc1 | grep -i "crash recovery"
   ```
5. **Resultado esperado**: MariaDB leerá el Redo Log (WAL en disco) aplicando **REDO** para transacciones en estado `COMMIT` y **UNDO** para transacciones pendientes, garantizando **Durabilidad** sin pérdida de información.

### 3. Registro y Generación del Reporte PDF
Haz clic en el botón **"📋 Abrir Plantilla de Registro y Análisis de Fallos"** en el Dashboard para abrir la plantilla imprimible y documentar los hallazgos académicos.
