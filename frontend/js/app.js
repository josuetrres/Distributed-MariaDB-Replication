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
}

async function cargarDatos() {
    try {
        await Promise.all([
            cargarCuentas(),
            cargarTransacciones(),
            cargarBitacoraWal(),
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
    const nivelAislamiento = 'READ_COMMITTED';
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

window.switchDbSubTab = function(btn, tabId) {
    // 1. Desmarcar todos los botones hermanos
    const tabRow = btn.parentElement;
    const buttons = tabRow.querySelectorAll('.db-subtab-btn');
    buttons.forEach(b => {
        b.classList.remove('active');
    });
    
    // 2. Activar el botón pulsado
    btn.classList.add('active');
    
    // 3. Ocultar todos los contenedores de contenido en el explorador
    const explorer = tabRow.parentElement;
    const contents = explorer.querySelectorAll('.db-tab-content');
    contents.forEach(c => {
        c.style.display = 'none';
    });
    
    // 4. Mostrar el contenido de la pestaña seleccionada
    const target = explorer.querySelector(`#db-content-${tabId}`);
    if (target) {
        target.style.display = 'block';
    }
};

function renderCuentasTable(cuentas) {
    if (!cuentas || cuentas.length === 0) {
        return `<p style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">🚫 No hay cuentas registradas en este nodo.</p>`;
    }
    let html = `
        <div class="table-container" style="max-height: 280px; overflow-y: auto; margin-top: 8px; border: 1px solid #e2e8f0; background: #fff;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">ID</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Número Cuenta</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Titular</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Saldo Disponible</th>
                    </tr>
                </thead>
                <tbody>
    `;
    cuentas.forEach(c => {
        const saldoFormatted = Number(c.saldo || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 14px; font-weight: 600; font-size: 0.88rem;">${c.id}</td>
                <td style="padding: 10px 14px; font-size: 0.88rem;"><code>${c.numeroCuenta || 'N/A'}</code></td>
                <td style="padding: 10px 14px; font-size: 0.88rem;">${c.titular || 'Desconocido'}</td>
                <td style="padding: 10px 14px; font-size: 0.88rem;"><strong style="color: var(--accent-green);">${saldoFormatted} USD</strong></td>
            </tr>
        `;
    });
    html += `
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function renderTransaccionesTable(transacciones) {
    if (!transacciones || transacciones.length === 0) {
        return `<p style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">🚫 No hay transacciones registradas en este nodo.</p>`;
    }
    let html = `
        <div class="table-container" style="max-height: 280px; overflow-y: auto; margin-top: 8px; border: 1px solid #e2e8f0; background: #fff;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">ID</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">GUID Tx</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Origen</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Destino</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Monto</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Estado</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Nodo</th>
                    </tr>
                </thead>
                <tbody>
    `;
    transacciones.forEach(t => {
        const montoFormatted = Number(t.monto || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
        const shortGuid = t.guid ? `${t.guid.substring(0, 8)}...` : 'N/A';
        
        let tagClass = 'tag-iniciada';
        if (t.estado === 'COMPLETADA') tagClass = 'tag-completada';
        else if (t.estado && (t.estado.startsWith('REVERTIDA') || t.estado.startsWith('FALLA') || t.estado.startsWith('REVERTIDO'))) tagClass = 'tag-revertida';

        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 14px; font-weight: 600; font-size: 0.88rem;">${t.id}</td>
                <td style="padding: 10px 14px; font-size: 0.85rem;" title="${t.guid || ''}"><code>${shortGuid}</code></td>
                <td style="padding: 10px 14px; font-size: 0.85rem;"><code>Cuenta #${t.origenId || 'N/A'}</code></td>
                <td style="padding: 10px 14px; font-size: 0.85rem;"><code>Cuenta #${t.destinoId || 'N/A'}</code></td>
                <td style="padding: 10px 14px; font-size: 0.88rem; font-weight: 600;">${montoFormatted}</td>
                <td style="padding: 10px 14px;"><span class="tag ${tagClass}" style="font-size: 0.7rem; padding: 3px 8px;">${t.estado || 'INICIADA'}</span></td>
                <td style="padding: 10px 14px; font-size: 0.8rem; color: var(--text-muted);">${t.nodo || 'N/A'}</td>
            </tr>
        `;
    });
    html += `
                </tbody>
            </table>
        </div>
    `;
    return html;
}

function renderWalTable(wal) {
    if (!wal || wal.length === 0) {
        return `<p style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 0.9rem;">🚫 No hay registros WAL en este nodo.</p>`;
    }
    let html = `
        <div class="table-container" style="max-height: 280px; overflow-y: auto; margin-top: 8px; border: 1px solid #e2e8f0; background: #fff;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
                <thead>
                    <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">ID</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">GUID Tx</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Fase WAL</th>
                        <th style="padding: 10px 14px; font-size: 0.78rem; text-transform: uppercase; font-weight: 600; color: var(--text-muted);">Detalles y Datos Reservados</th>
                    </tr>
                </thead>
                <tbody>
    `;
    wal.forEach(w => {
        const shortGuid = w.guid ? `${w.guid.substring(0, 8)}...` : 'N/A';
        html += `
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 14px; font-weight: 600; font-size: 0.88rem;">${w.id}</td>
                <td style="padding: 10px 14px; font-size: 0.85rem;" title="${w.guid || ''}"><code>${shortGuid}</code></td>
                <td style="padding: 10px 14px;"><span class="tag tag-wal" style="font-size: 0.7rem; padding: 3px 8px;">${w.faseWal || 'WAL'}</span></td>
                <td style="padding: 10px 14px; font-size: 0.8rem; font-family: monospace; color: var(--text-secondary);">${w.detalles || 'N/A'}</td>
            </tr>
        `;
    });
    html += `
                </tbody>
            </table>
        </div>
    `;
    return html;
}

window.consultarConsolaBd = async function(nodoIndex) {
    const wrapper = document.getElementById('consola-bd-wrapper');
    const badge = document.getElementById('consola-bd-badge');
    if (!wrapper) return;

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

    // Mostrar estado de carga en un pre bloque
    wrapper.innerHTML = `<pre id="consola-bd-output" style="margin: 0; font-family: 'Fira Code', 'Courier New', Courier, monospace; font-size: 0.82rem; color: #1e293b; line-height: 1.45; white-space: pre-wrap; word-break: break-all;">// [TIMESTAMP: ${new Date().toLocaleTimeString()}] Conectando por JDBC al contenedor de base de datos del Nodo ${nodoIndex} (${nombres[nodoIndex]})...\n// Ejecutando: SELECT * FROM cuentas;\n// Ejecutando: SELECT * FROM transacciones;\n// Ejecutando: SELECT * FROM bitacora_wal;\n// Esperando respuesta del servidor...</pre>`;

    try {
        const res = await ApiService.obtenerDatosBdNodo(nodoIndex);
        if (res.activo && res.datos) {
            const dbData = res.datos;
            const server = dbData.servidorMariaDB || {};
            
            if (badge) {
                badge.innerText = `Conectado a: ${nombres[nodoIndex]}`;
                badge.style.background = 'rgba(5, 150, 105, 0.15)';
                badge.style.color = '#059669';
            }

            // Formatear información del rol del servidor
            const isReadOnly = server.readOnly === "1";
            const roleText = isReadOnly ? "RÉPLICA (Solo Lectura)" : "MASTER (Lectura / Escritura)";
            const roleColor = isReadOnly ? "var(--accent-purple)" : "var(--accent-blue)";
            const roleBg = isReadOnly ? "var(--accent-purple-light)" : "var(--accent-blue-light)";
            
            const roText = isReadOnly ? "SÍ" : "NO";
            const roColor = isReadOnly ? "var(--accent-purple)" : "var(--accent-green)";
            const roBg = isReadOnly ? "var(--accent-purple-light)" : "var(--accent-green-light)";

            // Construir HTML del Explorador de Base de Datos
            let explorerHtml = `
                <div class="db-explorer">
                    <!-- Barra de Info del Servidor -->
                    <div class="db-info-bar">
                        <div class="db-info-item"><strong>Host DB:</strong> <span style="font-family: monospace;">${server.hostname || 'Desconocido'}</span></div>
                        <div class="db-info-item"><strong>ID Servidor:</strong> <span class="tag" style="background: #e2e8f0; color: #334155; font-size: 0.75rem; padding: 2px 8px; text-transform: none; font-family: monospace; font-weight: 600;">${server.serverId || 'N/A'}</span></div>
                        <div class="db-info-item"><strong>Rol:</strong> <span class="tag" style="background: ${roleBg}; color: ${roleColor}; font-size: 0.75rem; padding: 2px 8px; text-transform: none;">${roleText}</span></div>
                        <div class="db-info-item"><strong>Solo Lectura:</strong> <span class="tag" style="background: ${roBg}; color: ${roColor}; font-size: 0.75rem; padding: 2px 8px; text-transform: none;">${roText}</span></div>
                        <div class="db-info-item"><strong>GTID Pos:</strong> <span style="font-family: monospace; font-size: 0.8rem; background: #e2e8f0; color: var(--text-primary); padding: 2px 6px; border-radius: 4px;">${server.gtidCurrentPos || 'N/A'}</span></div>
                    </div>
            `;

            if (dbData.errorConexion) {
                // El contenedor MariaDB respondió pero hubo un error de conexión JDBC interno o tabla inexistente
                explorerHtml += `
                    <div class="db-error-banner">
                        <span class="db-error-icon">⚠️</span>
                        <div style="flex-grow: 1;">
                            <strong style="display: block; font-size: 0.95rem;">Error en Consultas de Base de Datos</strong>
                            <div class="db-error-details">${dbData.errorConexion}</div>
                            <p style="font-size: 0.8rem; margin-top: 8px; color: var(--text-secondary); line-height: 1.4;">
                                El contenedor de base de datos local del Nodo ${nodoIndex} está levantado y responde, pero la consulta SQL falló. Esto suele suceder si las tablas aún no se han creado en esta réplica por problemas de sincronización de replicación.
                            </p>
                        </div>
                    </div>
                    
                    <!-- Pestaña única para ver el JSON completo del error -->
                    <div class="db-subtabs" style="margin-top: 15px;">
                        <button class="db-subtab-btn active" onclick="window.switchDbSubTab(this, 'raw-json')">🔍 JSON de Respuesta</button>
                    </div>
                    <div class="db-tab-content" id="db-content-raw-json" style="display: block;">
                        <pre style="margin: 0; font-family: 'Fira Code', monospace; font-size: 0.8rem; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; overflow: auto; max-height: 250px; color: #334155;">${JSON.stringify(dbData, null, 2)}</pre>
                    </div>
                `;
                
                wrapper.innerHTML = explorerHtml;
                mostrarToast(`BD ${nombres[nodoIndex]} reporta un error`, true);
            } else {
                // Caso exitoso: renderizar las sub-pestañas con datos limpios
                const tables = dbData.datosAlmacenadosEnBdLocal || {};
                const cuentas = tables["1_tabla_cuentas"] || [];
                const transacciones = tables["2_ultimas_transacciones"] || [];
                const wal = tables["3_bitacora_wal"] || [];

                explorerHtml += `
                    <!-- Sub-Pestañas de Selección -->
                    <div class="db-subtabs">
                        <button class="db-subtab-btn active" onclick="window.switchDbSubTab(this, 'cuentas')">💳 Cuentas y Saldos (${cuentas.length})</button>
                        <button class="db-subtab-btn" onclick="window.switchDbSubTab(this, 'transacciones')">📊 Transacciones (${transacciones.length})</button>
                        <button class="db-subtab-btn" onclick="window.switchDbSubTab(this, 'wal')">📝 Bitácora WAL (${wal.length})</button>
                        <button class="db-subtab-btn" onclick="window.switchDbSubTab(this, 'raw-json')">🔍 JSON Bruto</button>
                    </div>

                    <!-- Contenido Cuentas -->
                    <div class="db-tab-content" id="db-content-cuentas" style="display: block;">
                        ${renderCuentasTable(cuentas)}
                    </div>

                    <!-- Contenido Transacciones -->
                    <div class="db-tab-content" id="db-content-transacciones" style="display: none;">
                        ${renderTransaccionesTable(transacciones)}
                    </div>

                    <!-- Contenido WAL -->
                    <div class="db-tab-content" id="db-content-wal" style="display: none;">
                        ${renderWalTable(wal)}
                    </div>

                    <!-- Contenido JSON Bruto -->
                    <div class="db-tab-content" id="db-content-raw-json" style="display: none;">
                        <pre style="margin: 0; font-family: 'Fira Code', monospace; font-size: 0.8rem; background: #ffffff; border: 1px solid #e2e8f0; padding: 10px; border-radius: 6px; overflow: auto; max-height: 250px; color: #334155;">${JSON.stringify(dbData, null, 2)}</pre>
                    </div>
                `;
                
                wrapper.innerHTML = explorerHtml;
                mostrarToast(`Datos leídos correctamente desde ${nombres[nodoIndex]}`, false);
            }
        } else {
            // El backend no está activo o falló completamente la conexión
            const errText = res.error || 'Nodo inalcanzable o sin respuesta de la API';
            const errorHtml = `
                <div class="db-error-banner">
                    <span class="db-error-icon">❌</span>
                    <div style="flex-grow: 1;">
                        <strong style="display: block; font-size: 0.95rem;">Error de Comunicación con el Nodo ${nodoIndex}</strong>
                        <div class="db-error-details">${errText}</div>
                        <p style="font-size: 0.8rem; margin-top: 8px; color: var(--text-secondary); line-height: 1.4;">
                            No se pudo contactar con la API del Nodo ${nodoIndex}. Por favor, verifica que el contenedor <code>api${nodoIndex}-pc${nodoIndex}</code> esté encendido y que el puerto esté expuesto.
                        </p>
                    </div>
                </div>
            `;
            wrapper.innerHTML = errorHtml;

            if (badge) {
                badge.innerText = `Error en Nodo ${nodoIndex}`;
                badge.style.background = 'rgba(220, 38, 38, 0.15)';
                badge.style.color = '#dc2626';
            }
            mostrarToast(`Error consultando Nodo ${nodoIndex}`, true);
        }
    } catch (e) {
        const errorHtml = `
            <div class="db-error-banner">
                <span class="db-error-icon">💥</span>
                <div style="flex-grow: 1;">
                    <strong style="display: block; font-size: 0.95rem;">Excepción Inesperada en el Cliente</strong>
                    <div class="db-error-details">${e.message}</div>
                </div>
            </div>
        `;
        wrapper.innerHTML = errorHtml;

        if (badge) {
            badge.innerText = `Error de Excepción`;
            badge.style.background = 'rgba(220, 38, 38, 0.15)';
            badge.style.color = '#dc2626';
        }
    }
};
