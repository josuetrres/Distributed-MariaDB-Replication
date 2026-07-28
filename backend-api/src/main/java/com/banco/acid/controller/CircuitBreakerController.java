package com.banco.acid.controller;

import com.banco.acid.dto.CircuitBreakerStatusDTO;
import com.banco.acid.dto.RespuestaSistema;
import com.banco.acid.service.CircuitBreakerService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/circuit-breaker")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CircuitBreakerController {

    private final CircuitBreakerService circuitBreakerService;

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    @GetMapping("/status")
    public ResponseEntity<RespuestaSistema<CircuitBreakerStatusDTO>> obtenerEstadoCircuitBreaker() {
        CircuitBreakerStatusDTO status = circuitBreakerService.obtenerEstado();
        return ResponseEntity.ok(RespuestaSistema.ok(
                "Estado del Circuit Breaker obtenido",
                nombreNodo,
                null,
                status
        ));
    }
}
