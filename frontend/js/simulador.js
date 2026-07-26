/**
 * Módulo de Simulación de Carga Concurrente, Pruebas ACID y Generador de Reportes de Fallos
 */
const SimuladorAcid = {

    async ejecutarPruebaCargaConcurrente(origenId, destinoId, cantidad) {
        const promesas = [];
        for (let i = 0; i < cantidad; i++) {
            promesas.push(ApiService.realizarTransferencia({
                cuentaOrigenId: origenId,
                cuentaDestinoId: destinoId,
                monto: 10.00,
                nivelAislamiento: 'SERIALIZABLE',
                simularError: false
            }));
        }
        return await Promise.allSettled(promesas);
    },

    abrirPlantillaAnalisis(txGuid) {
        const win = window.open('/plantillas/plantilla-analisis-fallos.html', '_blank');
        if (win && txGuid) {
            win.onload = () => {
                const el = win.document.getElementById('tx-guid-fallo');
                if (el) el.innerText = txGuid;
            };
        }
    }
};
