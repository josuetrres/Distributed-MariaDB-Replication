/**
 * Lógica Principal del Dashboard de Transacciones Bancarias ACID (Español)
 */
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

let timerRefresco = null;

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
            cargarInfoNodo()
        ]);
    } catch (err) {
        console.error('Error al actualizar dashboard:', err);
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

        tbody.innerHTML = '';
        res.datos.forEach(tx => {
            const tr = document.createElement('tr');
            const claseTag = tx.estado === 'COMPLETADA' ? 'tag-completada' : 'tag-revertida';
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
