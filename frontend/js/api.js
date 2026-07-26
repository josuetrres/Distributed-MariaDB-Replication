/**
 * Cliente de API para comunicación con el backend Spring Boot / Nginx Reverse Proxy
 */
const API_BASE = '/api/v1';

const ApiService = {

    async obtenerCuentas() {
        const resp = await fetch(`${API_BASE}/cuentas`);
        if (!resp.ok) throw new Error('Error al consultar cuentas bancarias');
        return await resp.json();
    },

    async realizarTransferencia(datos) {
        const resp = await fetch(`${API_BASE}/transacciones/transferir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        const resJson = await resp.json();
        if (!resp.ok && !resJson.mensaje) {
            throw new Error('Error en la solicitud de transferencia');
        }
        return resJson;
    },

    async obtenerUltimasTransacciones() {
        const resp = await fetch(`${API_BASE}/transacciones`);
        if (!resp.ok) throw new Error('Error al consultar transacciones');
        return await resp.json();
    },

    async obtenerBitacoraWal() {
        const resp = await fetch(`${API_BASE}/transacciones/wal`);
        if (!resp.ok) throw new Error('Error al consultar bitácora WAL');
        return await resp.json();
    },

    async obtenerMetricasWalInnodb() {
        const resp = await fetch(`${API_BASE}/metricas/innodb-wal`);
        if (!resp.ok) throw new Error('Error al consultar métricas WAL InnoDB');
        return await resp.json();
    },

    async obtenerInvarianteConsistencia() {
        const resp = await fetch(`${API_BASE}/cuentas/invariante-consistencia`);
        if (!resp.ok) throw new Error('Error al verificar invariante de consistencia');
        return await resp.json();
    },

    async obtenerInfoNodo() {
        const resp = await fetch(`${API_BASE}/metricas/nodo`);
        if (!resp.ok) throw new Error('Error al obtener info del nodo');
        return await resp.json();
    },

    async obtenerEstadoNodoEspecifico(nodoIndex) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        try {
            const resp = await fetch(`/api/node${nodoIndex}/metricas/nodo`, { signal: controller.signal });
            clearTimeout(id);
            if (!resp.ok) throw new Error(`Nodo ${nodoIndex} inactivo o inalcanzable`);
            const data = await resp.json();
            
            // Consultar LSN de forma independiente y resistente a fallos menores de red
            try {
                const controllerLsn = new AbortController();
                const idLsn = setTimeout(() => controllerLsn.abort(), 3000);
                const lsnResp = await fetch(`/api/node${nodoIndex}/metricas/innodb-wal`, { signal: controllerLsn.signal });
                clearTimeout(idLsn);
                if (lsnResp.ok) {
                    const lsnData = await lsnResp.json();
                    data.lsn = lsnData.lsn || lsnData.lsnSequenceNumber || 'N/A';
                }
            } catch (e) {
                data.lsn = data.datos?.lsn || 'Activo';
            }
            return { activo: true, info: data };
        } catch (error) {
            clearTimeout(id);
            return { activo: false, error: error.message };
        }
    },

    async obtenerEstadoReplicacionNodo(nodoIndex) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 3500);
        try {
            const resp = await fetch(`/api/node${nodoIndex}/metricas/replicacion`, { signal: controller.signal });
            clearTimeout(id);
            if (!resp.ok) throw new Error(`Error al consultar replicación en nodo ${nodoIndex}`);
            const resJson = await resp.json();
            return { activo: true, datos: resJson.datos };
        } catch (error) {
            clearTimeout(id);
            return { activo: false, error: error.message };
        }
    },

    async obtenerDatosBdNodo(nodoIndex) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        try {
            const resp = await fetch(`/api/node${nodoIndex}/metricas/datos-bd`, { signal: controller.signal });
            clearTimeout(id);
            if (!resp.ok) throw new Error(`Error al consultar datos en BD del nodo ${nodoIndex}`);
            const resJson = await resp.json();
            return { activo: true, datos: resJson.datos };
        } catch (error) {
            clearTimeout(id);
            return { activo: false, error: error.message };
        }
    }
};

