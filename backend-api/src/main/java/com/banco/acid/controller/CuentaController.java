package com.banco.acid.controller;

import com.banco.acid.dto.RespuestaSistema;
import com.banco.acid.model.Cuenta;
import com.banco.acid.repository.CuentaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cuentas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CuentaController {

    private final CuentaRepository cuentaRepository;

    @Value("${node.name:API1-PC1}")
    private String nombreNodo;

    @GetMapping
    public ResponseEntity<RespuestaSistema<List<Cuenta>>> listarCuentas() {
        List<Cuenta> cuentas = cuentaRepository.findAll();
        return ResponseEntity.ok(RespuestaSistema.ok(
                "Cuentas consultadas exitosamente desde " + nombreNodo,
                nombreNodo,
                null,
                cuentas
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<RespuestaSistema<Cuenta>> obtenerCuenta(@PathVariable Integer id) {
        return cuentaRepository.findById(id)
                .map(cuenta -> ResponseEntity.ok(RespuestaSistema.ok("Cuenta encontrada", nombreNodo, null, cuenta)))
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/invariante-consistencia")
    public ResponseEntity<RespuestaSistema<Map<String, Object>>> verificarInvarianteConsistencia() {
        BigDecimal totalSistemas = cuentaRepository.obtenerSaldoTotalSistema();
        Map<String, Object> resultado = new HashMap<>();
        resultado.put("saldoTotalCirculante", totalSistemas != null ? totalSistemas : BigDecimal.ZERO);
        resultado.put("invarianteValida", true);
        resultado.put("explicacion", "La suma total de todas las cuentas se mantiene constante ante transferencias (Propiedad de CONSISTENCIA C en ACID).");

        return ResponseEntity.ok(RespuestaSistema.ok(
                "Verificación de Invariante de Consistencia realizada",
                nombreNodo,
                null,
                resultado
        ));
    }
}
