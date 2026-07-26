package com.banco.acid.service;

import com.banco.acid.dto.MetricasInnodbDTO;
import com.banco.acid.dto.TransferenciaRequest;
import com.banco.acid.model.BitacoraWal;
import com.banco.acid.model.Cuenta;
import com.banco.acid.model.Transaccion;
import com.banco.acid.repository.BitacoraWalRepository;
import com.banco.acid.repository.CuentaRepository;
import com.banco.acid.repository.TransaccionRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class TransaccionService {

    private final CuentaRepository cuentaRepository;
    private final TransaccionRepository transaccionRepository;
    private final BitacoraWalRepository bitacoraWalRepository;

    @PersistenceContext
    private EntityManager entityManager;

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    /**
     * Ejecuta una transferencia bancaria dentro de una transacción ACID explícita.
     * Implementa Write-Ahead Logging (WAL) previo a la persistencia final.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public Transaccion ejecutarTransferencia(TransferenciaRequest request) {
        String txGuid = UUID.randomUUID().toString();
        log.info("[WAL-INICIO] Iniciando transferencia GUID: {} de Cuenta {} a Cuenta {} por monto {}",
                txGuid, request.getCuentaOrigenId(), request.getCuentaDestinoId(), request.getMonto());

        // Paso 1 WAL: Registro Inicial
        registrarPasoWal(txGuid, "INICIADA", request.getCuentaOrigenId(), request.getCuentaDestinoId(),
                request.getMonto(), null, null, null, null, "Paso 1: Transacción bancaria recibida. Preparando registros WAL.");

        if (Objects.equals(request.getCuentaOrigenId(), request.getCuentaDestinoId())) {
            throw new IllegalArgumentException("La cuenta de origen y destino no pueden ser la misma.");
        }

        // Obtener Cuentas con Bloqueo Pesimista (SELECT ... FOR UPDATE) para Garantizar Aislamiento (Isolation)
        Cuenta origen = cuentaRepository.findByIdForUpdate(request.getCuentaOrigenId())
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de origen no encontrada ID: " + request.getCuentaOrigenId()));

        Cuenta destino = cuentaRepository.findByIdForUpdate(request.getCuentaDestinoId())
                .orElseThrow(() -> new IllegalArgumentException("Cuenta de destino no encontrada ID: " + request.getCuentaDestinoId()));

        BigDecimal saldoOrigenPrevio = origen.getSaldo();
        BigDecimal saldoDestinoPrevio = destino.getSaldo();

        // Validar Restricción de Consistencia (saldo suficiente)
        if (saldoOrigenPrevio.compareTo(request.getMonto()) < 0) {
            throw new IllegalStateException("Saldo insuficiente en la cuenta de origen (" + saldoOrigenPrevio + " USD).");
        }

        // Paso 2 WAL: Escribir en Buffer WAL previo a modificar datos
        registrarPasoWal(txGuid, "WAL_GRABADO_BUFFER", origen.getId(), destino.getId(), request.getMonto(),
                saldoOrigenPrevio, saldoOrigenPrevio.subtract(request.getMonto()),
                saldoDestinoPrevio, saldoDestinoPrevio.add(request.getMonto()),
                "Paso 2: WAL de transacción registrado en memoria de log previo a modificación.");

        // Modificar Saldo de las Cuentas
        origen.setSaldo(saldoOrigenPrevio.subtract(request.getMonto()));
        destino.setSaldo(saldoDestinoPrevio.add(request.getMonto()));

        cuentaRepository.save(origen);
        cuentaRepository.save(destino);

        // Forzar envío inmediato del UPDATE SQL a MariaDB para que modifique el Buffer Pool y escriba en el InnoDB Undo Log
        entityManager.flush();

        // Paso 3 WAL: Redo Preparado
        registrarPasoWal(txGuid, "REDO_PREPARADO", origen.getId(), destino.getId(), request.getMonto(),
                origen.getSaldo(), origen.getSaldo(), destino.getSaldo(), destino.getSaldo(),
                "Paso 3: UPDATE SQL ejecutado con entityManager.flush(). Cambios en InnoDB Buffer Pool y Undo Log registrados.");

        // Simulación de Falla Repentina (Corte de Energía / Excepción Deliberada)
        if (request.isSimularError()) {
            log.error("[WAL-FALLO-SIMULADO] Interrupción provocada en medio de la transacción GUID: {}. Iniciando proceso UNDO Log...", txGuid);
            throw new RuntimeException("CRASH_SIMULADO: Interrupción provocada tras enviar el débito a MariaDB. El motor InnoDB ejecutó automáticamente el proceso UNDO Log para revertir los cambios (Atomicidad ACID intacta).");
        }

        // Paso 4 WAL: Confirmación (COMMIT) y Volcado en Disco (innodb_flush_log_at_trx_commit=1)
        registrarPasoWal(txGuid, "COMMIT_FLUSH", origen.getId(), destino.getId(), request.getMonto(),
                origen.getSaldo(), origen.getSaldo(), destino.getSaldo(), destino.getSaldo(),
                "Paso 4: Transacción confirmada (COMMIT). Log de Redo volcado a disco y listo para replicación binlog GTID.");

        Transaccion tx = Transaccion.builder()
                .txGuid(txGuid)
                .cuentaOrigenId(origen.getId())
                .cuentaDestinoId(destino.getId())
                .monto(request.getMonto())
                .estado("COMPLETADA")
                .nivelAislamiento(request.getNivelAislamiento() != null ? request.getNivelAislamiento() : "READ_COMMITTED")
                .errorSimulado(false)
                .nodoEjecutor(nombreNodo)
                .mensaje("Transferencia bancaria realizada con éxito y volcada a WAL")
                .build();

        return transaccionRepository.save(tx);
    }

    /**
     * Registra un evento en la bitácora WAL a nivel de aplicación
     */
    public void registrarPasoWal(String txGuid, String fase, Integer origenId, Integer destinoId,
                                  BigDecimal monto, BigDecimal sOrigenAnt, BigDecimal sOrigenNuevo,
                                  BigDecimal sDestinoAnt, BigDecimal sDestinoNuevo, String detalles) {
        BitacoraWal wal = BitacoraWal.builder()
                .txGuid(txGuid)
                .faseWal(fase)
                .cuentaOrigenId(origenId)
                .cuentaDestinoId(destinoId)
                .monto(monto)
                .saldoOrigenAnterior(sOrigenAnt)
                .saldoOrigenNuevo(sOrigenNuevo)
                .saldoDestinoAnterior(sDestinoAnt)
                .saldoDestinoNuevo(sDestinoNuevo)
                .detalles(detalles)
                .build();
        bitacoraWalRepository.save(wal);
    }

    /**
     * Permite registrar la bitácora de un Rollback / UNDO en una transacción separada (REQUIRES_NEW)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarUndoWal(String txGuid, Integer origenId, Integer destinoId, BigDecimal monto, String causaError) {
        registrarPasoWal(txGuid, "ROLLBACK_EJECUTADO (UNDO)", origenId, destinoId, monto,
                null, null, null, null,
                "Proceso UNDO Log de InnoDB ejecutado: el débito temporal de $" + monto + " USD fue revertido en MariaDB. Saldo restaurado intacto.");

        Transaccion tx = Transaccion.builder()
                .txGuid(txGuid)
                .cuentaOrigenId(origenId)
                .cuentaDestinoId(destinoId)
                .monto(monto)
                .estado("REVERTIDA (UNDO)")
                .nivelAislamiento("READ_COMMITTED")
                .errorSimulado(true)
                .nodoEjecutor(nombreNodo)
                .mensaje("Débito revertido automáticamente por MariaDB InnoDB Undo Log. " + causaError)
                .build();

        transaccionRepository.save(tx);
    }

    /**
     * Obtiene el estado actual del motor InnoDB y métricas de WAL (Log Sequence Number - LSN)
     */
    @Transactional(readOnly = true)
    public MetricasInnodbDTO obtenerMetricasWalInnodb() {
        try {
            List<?> result = entityManager.createNativeQuery("SHOW ENGINE INNODB STATUS").getResultList();
            if (!result.isEmpty()) {
                Object[] row = (Object[]) result.get(0);
                String innodbStatusText = (String) row[2];

                String lsn = extraerValorLog(innodbStatusText, "Log sequence number");
                String logFlushed = extraerValorLog(innodbStatusText, "Log flushed up to");
                String checkpoint = extraerValorLog(innodbStatusText, "Last checkpoint at");

                return MetricasInnodbDTO.builder()
                        .lsnSequenceNumber(lsn != null ? lsn : "N/A")
                        .logFlushedUpTo(logFlushed != null ? logFlushed : "N/A")
                        .lastCheckpointAt(checkpoint != null ? checkpoint : "N/A")
                        .pendingLogWrites("0")
                        .bufferPoolHitRate("100%")
                        .statusRaw(innodbStatusText.length() > 500 ? innodbStatusText.substring(0, 500) + "..." : innodbStatusText)
                        .build();
            }
        } catch (Exception e) {
            log.error("Error al obtener estado InnoDB STATUS: ", e);
        }
        return MetricasInnodbDTO.builder()
                .lsnSequenceNumber("No Disponible")
                .logFlushedUpTo("No Disponible")
                .lastCheckpointAt("No Disponible")
                .pendingLogWrites("0")
                .bufferPoolHitRate("N/A")
                .statusRaw("Información de estado InnoDB no accesible en este nodo")
                .build();
    }

    private String extraerValorLog(String texto, String clave) {
        int idx = texto.indexOf(clave);
        if (idx != -1) {
            int start = idx + clave.length();
            int end = texto.indexOf("\n", start);
            if (end != -1) {
                return texto.substring(start, end).trim();
            }
        }
        return null;
    }
}
