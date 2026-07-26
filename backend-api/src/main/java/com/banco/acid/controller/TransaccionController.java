package com.banco.acid.controller;

import com.banco.acid.dto.RespuestaSistema;
import com.banco.acid.dto.TransferenciaRequest;
import com.banco.acid.model.BitacoraWal;
import com.banco.acid.model.Transaccion;
import com.banco.acid.repository.BitacoraWalRepository;
import com.banco.acid.repository.TransaccionRepository;
import com.banco.acid.service.TransaccionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/transacciones")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Slf4j
public class TransaccionController {

    private final TransaccionService transaccionService;
    private final TransaccionRepository transaccionRepository;
    private final BitacoraWalRepository bitacoraWalRepository;

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    @PostMapping("/transferir")
    public ResponseEntity<RespuestaSistema<Transaccion>> transferir(@Valid @RequestBody TransferenciaRequest request) {
        String txGuidTmp = java.util.UUID.randomUUID().toString();
        try {
            Transaccion tx = transaccionService.ejecutarTransferencia(request);
            return ResponseEntity.ok(RespuestaSistema.ok(
                    "Transferencia bancaria procesada correctamente con registro en WAL",
                    nombreNodo,
                    tx.getTxGuid(),
                    tx
            ));
        } catch (Exception e) {
            log.error("Excepción detectada durante la transferencia: {}", e.getMessage());
            // Registrar auditoría de Rollback en bitácora WAL
            transaccionService.registrarUndoWal(txGuidTmp, request.getCuentaOrigenId(), request.getCuentaDestinoId(), request.getMonto(), e.getMessage());

            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(RespuestaSistema.error(
                            "Proceso UNDO ejecutado: Transacción revertida completamente en MariaDB. Causa: " + e.getMessage(),
                            nombreNodo,
                            txGuidTmp,
                            null
                    ));
        }
    }

    @GetMapping
    public ResponseEntity<RespuestaSistema<List<Transaccion>>> listarUltimasTransacciones() {
        List<Transaccion> txs = transaccionRepository.findTop50ByOrderByIdDesc();
        return ResponseEntity.ok(RespuestaSistema.ok(
                "Historial de transacciones consultado",
                nombreNodo,
                null,
                txs
        ));
    }

    @GetMapping("/wal")
    public ResponseEntity<RespuestaSistema<List<BitacoraWal>>> listarBitacoraWal() {
        List<BitacoraWal> logsWal = bitacoraWalRepository.findTop50ByOrderByIdDesc();
        return ResponseEntity.ok(RespuestaSistema.ok(
                "Bitácora WAL de aplicación consultada",
                nombreNodo,
                null,
                logsWal
        ));
    }
}
