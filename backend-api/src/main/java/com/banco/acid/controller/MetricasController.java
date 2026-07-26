package com.banco.acid.controller;

import com.banco.acid.dto.MetricasInnodbDTO;
import com.banco.acid.dto.RespuestaSistema;
import com.banco.acid.service.TransaccionService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/metricas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class MetricasController {

    private final TransaccionService transaccionService;

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    @Value("${node.db.master-host:localhost}")
    private String masterHost;

    @Value("${node.db.replica-host:localhost}")
    private String replicaHost;

    @GetMapping("/innodb-wal")
    public ResponseEntity<RespuestaSistema<MetricasInnodbDTO>> obtenerMetricasWal() {
        MetricasInnodbDTO metricas = transaccionService.obtenerMetricasWalInnodb();
        return ResponseEntity.ok(RespuestaSistema.ok(
                "Métricas InnoDB Redo Log / WAL obtenidas",
                nombreNodo,
                null,
                metricas
        ));
    }

    @GetMapping("/nodo")
    public ResponseEntity<RespuestaSistema<Map<String, String>>> obtenerInfoNodo() {
        Map<String, String> info = new HashMap<>();
        info.put("nombreNodo", nombreNodo);
        info.put("dbMasterHost", masterHost);
        info.put("dbReplicaHost", replicaHost);
        info.put("puertoServicio", System.getenv("SERVER_PORT") != null ? System.getenv("SERVER_PORT") : "8081");
        info.put("estado", "ACTIVO");

        return ResponseEntity.ok(RespuestaSistema.ok(
                "Información del nodo obtenida",
                nombreNodo,
                null,
                info
        ));
    }
}
