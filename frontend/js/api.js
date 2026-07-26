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
    }
};
