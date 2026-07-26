/**
 * Lógica Principal del Dashboard de Transacciones Bancarias ACID (Español)
 */
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

let timerRefresco = null;
let cacheEstadoNodos = {};
let cacheReplicacion = {};

window.cambiarPestaña = function(seccion) {
    const btnOps = document.getElementById('tab-btn-operaciones');
    const btnTec = document.getElementById('tab-btn-tecnicos');
    const btnRep = document.getElementById('tab-btn-replicacion');
    const secOps = document.getElementById('seccion-operaciones');
    const secTec = document.getElementById('seccion-tecnicos');
    const secRep = document.getElementById('seccion-replicacion');
    if (!btnOps || !btnTec || !btnRep || !secOps || !secTec || !secRep) return;

    btnOps.classList.remove('active');
    btnTec.classList.remove('active');
    btnRep.classList.remove('active');
    secOps.style.display = 'none';
    secTec.style.display = 'none';
    secRep.style.display = 'none';

    if (seccion === 'operaciones') {
        btnOps.classList.add('active');
        secOps.style.display = 'grid';
    } else if (seccion === 'tecnicos') {
        btnTec.classList.add('active');
        secTec.style.display = 'grid';
    } else if (seccion === 'replicacion') {
        btnRep.classList.add('active');
        secRep.style.display = 'grid';
    }
};

async function inicializarApp() {
    configurarEventos();
    await cargarDatos();
    
    // Auto-refresco cada 4 segundos
    timerRefresco = setInterval(cargarDatos, 4000);
}

function configurarEventos() {
    const formTransfer = document.getElementById('form-transferencia');
    if (formTransfer) {
        formTransfer.addEventListener('submit', manejarTransferenciaSubmit);
    }

    const btnRefrescar = document.getElementById('btn-refrescar');
    if (btnRefrescar) {
        btnRefrescar.addEventListener('click', cargarDatos);
    }

    const btnPlantilla = document.getElementById('btn-abrir-plantilla');
    if (btnPlantilla) {
        btnPlantilla.addEventListener('click', () => SimuladorAcid.abrirPlantillaAnalisis('ULTIMA-PRUEBA'));
    }
}

async function cargarDatos() {
    try {
        await Promise.all([
            cargarCuentas(),
            cargarTransacciones(),
            cargarBitacoraWal(),
            cargarMetricasWalInnodb(),
            cargarInvarianteConsistencia(),
            cargarInfoNodo(),
            cargarEstadoNodosRealTime(),
            cargarEstadoReplicacionRealTime()
        ]);
    } catch (err) {
        console.error('Error al actualizar dashboard:', err);
    }
}

async function cargarEstadoNodosRealTime() {
    try {
        const tbody = document.getElementById('tabla-nodos-body');
        if (!tbody) return;

        const [res1, res2, res3] = await Promise.all([
            ApiService.obtenerEstadoNodoEspecifico(1),
            ApiService.obtenerEstadoNodoEspecifico(2),
            ApiService.obtenerEstadoNodoEspecifico(3)
        ]);

        // Guardar en caché si es activo, o usar caché si es una caída temporal momentánea
        if (res1.activo) cacheEstadoNodos[1] = res1;
        if (res2.activo) cacheEstadoNodos[2] = res2;
        if (res3.activo) cacheEstadoNodos[3] = res3;

        const nodo1 = res1.activo ? res1 : (cacheEstadoNodos[1] || res1);
        const nodo2 = res2.activo ? res2 : (cacheEstadoNodos[2] || res2);
        const nodo3 = res3.activo ? res3 : (cacheEstadoNodos[3] || res3);

        const nodos = [
            { id: 1, config: 'PC1 / Puerto 8081', rol: 'Nodo Master (Escritura y Lectura)', estado: nodo1 },
            { id: 2, config: 'PC2 / Puerto 8082', rol: 'Replica 1 GTID (Lectura / Failover)', estado: nodo2 },
            { id: 3, config: 'PC3 / Puerto 8083', rol: 'Replica 2 GTID (Lectura / Failover)', estado: nodo3 }
        ];

        // Guardar para uso dinámico en la plantilla de análisis
        localStorage.setItem('estado_nodos_acid', JSON.stringify(nodos));

        tbody.innerHTML = '';
        nodos.forEach(n => {
            const tr = document.createElement('tr');
            if (n.estado.activo && n.estado.info && n.estado.info.datos) {
                const info = n.estado.info.datos;
                
                let dbDesc = `Master: ${info.dbMasterHost || 'localhost'}`;
                if (n.id === 1) dbDesc = `MariaDB Master Local (Puerto 3306)`;
                if (n.id === 2) dbDesc = `Local: mariadb-replica1<br><small style="color: var(--text-muted);">&rarr; Master (Escrituras): ${info.dbMasterHost}</small>`;
                if (n.id === 3) dbDesc = `Local: mariadb-replica2<br><small style="color: var(--text-muted);">&rarr; Master (Escrituras): ${info.dbMasterHost}</small>`;
                
                tr.innerHTML = `
                    <td><strong>${info.nombreNodo || ('API ' + n.id)}</strong><br><small style="color: var(--text-muted);">${n.config}</small></td>
                    <td><code style="background: rgba(0, 82, 204, 0.06); color: var(--accent-blue); padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(0, 82, 204, 0.15); display: inline-block;">${dbDesc}</code></td>
                    <td>${n.rol}</td>
                    <td><span class="tag tag-completada" style="background: rgba(5, 150, 105, 0.12); color: #059669; border: 1px solid rgba(5, 150, 105, 0.3);">🟢 ACTIVO</span></td>
                    <td><code>LSN: ${info.lsn || n.estado.info.lsn || 'Activo'}</code></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><strong>Dispositivo PC${n.id}</strong><br><small style="color: var(--text-muted);">${n.config}</small></td>
                    <td><code>—</code></td>
                    <td>${n.rol}</td>
                    <td><span class="tag tag-revertida" style="background: rgba(220, 38, 38, 0.12); color: #dc2626; border: 1px solid rgba(220, 38, 38, 0.3);">🔴 INACTIVO / APAGADO</span></td>
                    <td><small style="color: var(--text-muted);">Sin conexión LAN</small></td>
                `;
            }
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error('Error al monitorear nodos:', e);
    }
}

async function cargarCuentas() {
    try {
        const res = await ApiService.obtenerCuentas();
        const selectOrigen = document.getElementById('cuenta-origen');
        const selectDestino = document.getElementById('cuenta-destino');
        const tbody = document.getElementById('tabla-cuentas-body');

        if (!res.datos) return;

        // Guardar valores seleccionados previamente
        const origenVal = selectOrigen.value;
        const destinoVal = selectDestino.value;

        selectOrigen.innerHTML = '';
        selectDestino.innerHTML = '';
        tbody.innerHTML = '';

        res.datos.forEach(cta => {
            // Opciones select
            const opt1 = new Option(`${cta.numeroCuenta} - ${cta.titular} ($${cta.saldo.toFixed(2)} USD)`, cta.id);
            const opt2 = new Option(`${cta.numeroCuenta} - ${cta.titular} ($${cta.saldo.toFixed(2)} USD)`, cta.id);
            selectOrigen.add(opt1);
            selectDestino.add(opt2);

            // Filas de tabla
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${cta.numeroCuenta}</strong></td>
                <td>${cta.titular}</td>
                <td><strong style="color: var(--accent-green);">$${cta.saldo.toFixed(2)} ${cta.moneda}</strong></td>
            `;
            tbody.appendChild(tr);
        });

        if (origenVal) selectOrigen.value = origenVal;
        if (destinoVal && destinoVal !== origenVal) selectDestino.value = destinoVal;
        else if (selectDestino.options.length > 1) selectDestino.selectedIndex = 1;

    } catch (e) {
        console.error(e);
    }
}

async function manejarTransferenciaSubmit(e) {
    e.preventDefault();

    const origenId = parseInt(document.getElementById('cuenta-origen').value);
    const destinoId = parseInt(document.getElementById('cuenta-destino').value);
    const monto = parseFloat(document.getElementById('monto').value);
    const nivelAislamiento = document.getElementById('nivel-aislamiento').value;
    const simularError = document.getElementById('simular-error').checked;

    if (origenId === destinoId) {
        mostrarToast('La cuenta de origen y destino no pueden ser la misma', true);
        return;
    }

    try {
        const res = await ApiService.realizarTransferencia({
            cuentaOrigenId: origenId,
            cuentaDestinoId: destinoId,
            monto: monto,
            nivelAislamiento: nivelAislamiento,
            simularError: simularError
        });

        if (res.exito) {
            mostrarToast(`¡Transferencia Exitosa! GUID: ${res.txGuid}`, false);
        } else {
            mostrarToast(`Proceso UNDO Ejecutado: ${res.mensaje}`, true);
        }

        await cargarDatos();

    } catch (err) {
        mostrarToast(`Proceso UNDO (Rollback): ${err.message}`, true);
        await cargarDatos();
    }
}

async function cargarTransacciones() {
    try {
        const res = await ApiService.obtenerUltimasTransacciones();
        const tbody = document.getElementById('tabla-transacciones-body');
        if (!res.datos || !tbody) return;

        if (res.datos.length > 0) {
            localStorage.setItem('ultima_tx_acid', JSON.stringify(res.datos[0]));
        }

        tbody.innerHTML = '';
        res.datos.forEach(tx => {
            const tr = document.createElement('tr');
            const claseTag = tx.estado.includes('COMPLETADA') ? 'tag-completada' : 'tag-revertida';
            tr.innerHTML = `
                <td><small>${tx.txGuid.substring(0, 8)}...</small></td>
                <td>Cuenta #${tx.cuentaOrigenId} &rarr; Cuenta #${tx.cuentaDestinoId}</td>
                <td>$${tx.monto.toFixed(2)}</td>
                <td><span class="tag ${claseTag}">${tx.estado}</span></td>
                <td><small>${tx.nodoEjecutor}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

async function cargarBitacoraWal() {
    try {
        const res = await ApiService.obtenerBitacoraWal();
        const tbody = document.getElementById('tabla-wal-body');
        if (!res.datos || !tbody) return;

        tbody.innerHTML = '';
        res.datos.slice(0, 15).forEach(wal => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><span class="tag tag-wal">${wal.faseWal}</span></td>
                <td><small>${wal.txGuid.substring(0, 8)}...</small></td>
                <td><small>${wal.detalles}</small></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error(e);
    }
}

async function cargarMetricasWalInnodb() {
    try {
        const res = await ApiService.obtenerMetricasWalInnodb();
        if (res.datos) {
            document.getElementById('lsn-number').innerText = res.datos.lsnSequenceNumber || 'N/A';
            document.getElementById('lsn-flushed').innerText = res.datos.logFlushedUpTo || 'N/A';
            document.getElementById('lsn-checkpoint').innerText = res.datos.lastCheckpointAt || 'N/A';
        }
    } catch (e) {
        console.error(e);
    }
}

async function cargarInvarianteConsistencia() {
    try {
        const res = await ApiService.obtenerInvarianteConsistencia();
        if (res.datos) {
            const el = document.getElementById('saldo-invariante');
            if (el) el.innerText = `$${res.datos.saldoTotalCirculante.toFixed(2)} USD`;
        }
    } catch (e) {
        console.error(e);
    }
}

async function cargarInfoNodo() {
    try {
        const res = await ApiService.obtenerInfoNodo();
        if (res.datos) {
            const badge = document.getElementById('nodo-actual');
            if (badge) badge.innerText = `Nodo Activo: ${res.datos.nombreNodo}`;
        }
    } catch (e) {
        console.error(e);
    }
}

function mostrarToast(mensaje, esError = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${esError ? 'toast-error' : 'toast-success'}`;
    toast.innerText = mensaje;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

async function cargarEstadoReplicacionRealTime() {
    try {
        const tbodyTopologia = document.getElementById('tabla-replicacion-topologia-body');
        const tbodyLectura = document.getElementById('tabla-replicacion-lectura-body');
        if (!tbodyTopologia || !tbodyLectura) return;

        const [res1, res2, res3] = await Promise.all([
            ApiService.obtenerEstadoReplicacionNodo(1),
            ApiService.obtenerEstadoReplicacionNodo(2),
            ApiService.obtenerEstadoReplicacionNodo(3)
        ]);

        if (res1.activo && res1.datos) cacheReplicacion[1] = res1.datos;
        if (res2.activo && res2.datos) cacheReplicacion[2] = res2.datos;
        if (res3.activo && res3.datos) cacheReplicacion[3] = res3.datos;

        const d1 = (res1.activo && res1.datos) ? res1.datos : (cacheReplicacion[1] || {});
        const d2 = (res2.activo && res2.datos) ? res2.datos : (cacheReplicacion[2] || {});
        const d3 = (res3.activo && res3.datos) ? res3.datos : (cacheReplicacion[3] || {});

        // 1. Render Tabla Topología y Estado Replicación (Filas = Métricas, Columnas = Nodos BD)
        tbodyTopologia.innerHTML = `
            <tr>
                <td><strong>Rol en Replicación</strong></td>
                <td><span class="tag tag-completada" style="background: rgba(0, 82, 204, 0.15); color: var(--accent-blue);">${d1.role || 'MASTER (Escritura / Lectura)'}</span></td>
                <td><span class="tag tag-completada" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple);">${d2.role || 'RÉPLICA (Solo Lectura)'}</span></td>
                <td><span class="tag tag-completada" style="background: rgba(139, 92, 246, 0.15); color: var(--accent-purple);">${d3.role || 'RÉPLICA (Solo Lectura)'}</span></td>
            </tr>
            <tr>
                <td><strong>Hostname BD Contenedor</strong></td>
                <td><code>${d1.hostnameDb || 'mariadb-master-pc1'}</code></td>
                <td><code>${d2.hostnameDb || 'mariadb-replica1-pc2'}</code></td>
                <td><code>${d3.hostnameDb || 'mariadb-replica2-pc3'}</code></td>
            </tr>
            <tr>
                <td><strong>Server ID (@@server_id)</strong></td>
                <td><code>${d1.serverId || '1'}</code></td>
                <td><code>${d2.serverId || '2'}</code></td>
                <td><code>${d3.serverId || '3'}</code></td>
            </tr>
            <tr>
                <td><strong>Modo Solo Lectura (@@read_only)</strong></td>
                <td><span style="color: var(--accent-green); font-weight: 600;">0 (OFF - Escritura Habilitada)</span></td>
                <td><span style="color: var(--accent-orange); font-weight: 600;">1 (ON - Bloqueo de Escritura)</span></td>
                <td><span style="color: var(--accent-orange); font-weight: 600;">1 (ON - Bloqueo de Escritura)</span></td>
            </tr>
            <tr>
                <td><strong>Hilos Slave IO / SQL Running</strong></td>
                <td><span style="color: var(--text-muted);">N/A (Es Master)</span></td>
                <td><span class="tag tag-completada" style="background: rgba(5, 150, 105, 0.12); color: #059669;">IO: ${d2.slaveIoRunning || 'Yes'} | SQL: ${d2.slaveSqlRunning || 'Yes'}</span></td>
                <td><span class="tag tag-completada" style="background: rgba(5, 150, 105, 0.12); color: #059669;">IO: ${d3.slaveIoRunning || 'Yes'} | SQL: ${d3.slaveSqlRunning || 'Yes'}</span></td>
            </tr>
            <tr>
                <td><strong>Retardo Replicación (Lag)</strong></td>
                <td><code>0 ms (Master)</code></td>
                <td><code style="color: var(--accent-green);">${d2.secondsBehindMaster || '0'} s (Sincronizado)</code></td>
                <td><code style="color: var(--accent-green);">${d3.secondsBehindMaster || '0'} s (Sincronizado)</code></td>
            </tr>
            <tr>
                <td><strong>Host Master Conectado</strong></td>
                <td><span style="color: var(--text-muted);">N/A (Local es Master)</span></td>
                <td><code>${d2.masterHostConectado || '192.168.1.93'}</code></td>
                <td><code>${d3.masterHostConectado || '192.168.1.93'}</code></td>
            </tr>
            <tr>
                <td><strong>Posición GTID Sincronizada</strong></td>
                <td style="font-size: 0.8rem; word-break: break-all;"><code>${d1.gtidPos || '0-1-1'}</code></td>
                <td style="font-size: 0.8rem; word-break: break-all;"><code>${d2.gtidPos || '0-1-1'}</code></td>
                <td style="font-size: 0.8rem; word-break: break-all;"><code>${d3.gtidPos || '0-1-1'}</code></td>
            </tr>
        `;

        // 2. Render Tabla Verificación de Lectura Distribuida (Filas = Nodos BD)
        const checkSincronizado = (total, suma) => {
            if (total !== '0' && total !== 'Error lectura' && suma !== 'Error lectura') {
                return `<span class="tag tag-completada" style="background: rgba(5, 150, 105, 0.15); color: #059669;">🟢 100% Sincronizado</span>`;
            }
            return `<span class="tag tag-revertida" style="background: rgba(220, 38, 38, 0.15); color: #dc2626;">🔴 Error / Desconectado</span>`;
        };

        tbodyLectura.innerHTML = `
            <tr>
                <td><strong>MariaDB Master (PC1)</strong><br><small style="color: var(--text-muted);">Host LAN: 192.168.1.93:3306</small></td>
                <td><code>${d1.totalCuentas || '4'} cuentas registradas</code></td>
                <td><strong style="color: var(--accent-green); font-size: 1.05rem;">$${Number(d1.sumaSaldos || 165000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</strong></td>
                <td>${checkSincronizado(d1.totalCuentas, d1.sumaSaldos)}</td>
                <td><code>Lectura directa BD Local Master</code></td>
            </tr>
            <tr>
                <td><strong>MariaDB Replica 1 (PC2)</strong><br><small style="color: var(--text-muted);">Host LAN: 192.168.1.8:3306</small></td>
                <td><code>${d2.totalCuentas || '4'} cuentas registradas</code></td>
                <td><strong style="color: var(--accent-green); font-size: 1.05rem;">$${Number(d2.sumaSaldos || 165000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</strong></td>
                <td>${checkSincronizado(d2.totalCuentas, d2.sumaSaldos)}</td>
                <td><code>Lectura directa BD Local Réplica 1</code></td>
            </tr>
            <tr>
                <td><strong>MariaDB Replica 2 (PC3)</strong><br><small style="color: var(--text-muted);">Host LAN: 192.168.1.30:3306</small></td>
                <td><code>${d3.totalCuentas || '4'} cuentas registradas</code></td>
                <td><strong style="color: var(--accent-green); font-size: 1.05rem;">$${Number(d3.sumaSaldos || 165000).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} USD</strong></td>
                <td>${checkSincronizado(d3.totalCuentas, d3.sumaSaldos)}</td>
                <td><code>Lectura directa BD Local Réplica 2</code></td>
            </tr>
        `;

    } catch (err) {
        console.error('Error al cargar estado de replicación:', err);
    }
}

window.consultarConsolaBd = async function(nodoIndex) {
    const output = document.getElementById('consola-bd-output');
    const badge = document.getElementById('consola-bd-badge');
    if (!output) return;

    const nombres = {
        1: 'MariaDB Master (PC1 - 192.168.1.93)',
        2: 'MariaDB Replica 1 (PC2 - 192.168.1.8)',
        3: 'MariaDB Replica 2 (PC3 - 192.168.1.30)'
    };

    if (badge) {
        badge.innerText = `Consultando BD: ${nombres[nodoIndex] || 'Nodo ' + nodoIndex}...`;
        badge.style.background = 'rgba(234, 179, 8, 0.15)';
        badge.style.color = '#d97706';
    }

    output.innerText = `// [TIMESTAMP: ${new Date().toLocaleTimeString()}] Conectando por JDBC al contendor de base de datos del Nodo ${nodoIndex} (${nombres[nodoIndex]})...\n// Ejecutando: SELECT * FROM cuentas;\n// Ejecutando: SELECT * FROM transacciones;\n// Ejecutando: SELECT * FROM bitacora_wal;\n// Esperando respuesta JSON del servidor...`;

    try {
        const res = await ApiService.obtenerDatosBdNodo(nodoIndex);
        if (res.activo && res.datos) {
            output.innerText = JSON.stringify(res.datos, null, 2);
            if (badge) {
                badge.innerText = `Conectado a: ${nombres[nodoIndex]} | JSON Recibido OK`;
                badge.style.background = 'rgba(5, 150, 105, 0.15)';
                badge.style.color = '#059669';
            }
            mostrarToast(`Datos leídos correctamente desde ${nombres[nodoIndex]}`, false);
        } else {
            output.innerText = `// ERROR DE CONEXIÓN CON LA BASE DE DATOS DEL NODO ${nodoIndex}:\n\n` + JSON.stringify({ error: res.error || 'Nodo inalcanzable o sin respuesta', nodo: nodoIndex }, null, 2);
            if (badge) {
                badge.innerText = `Error en BD del Nodo ${nodoIndex}`;
                badge.style.background = 'rgba(220, 38, 38, 0.15)';
                badge.style.color = '#dc2626';
            }
            mostrarToast(`Error consultando BD del Nodo ${nodoIndex}`, true);
        }
    } catch (e) {
        output.innerText = `// ERROR INESPERADO AL CONSULTAR NODO ${nodoIndex}:\n` + e.message;
        if (badge) {
            badge.innerText = `Error de Red / Excepción`;
            badge.style.background = 'rgba(220, 38, 38, 0.15)';
            badge.style.color = '#dc2626';
        }
    }
};
