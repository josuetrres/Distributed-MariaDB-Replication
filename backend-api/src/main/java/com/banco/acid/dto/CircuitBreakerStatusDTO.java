package com.banco.acid.dto;

import com.banco.acid.model.CircuitBreakerState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CircuitBreakerStatusDTO {
    private CircuitBreakerState estado;
    private int nodosActivos;
    private int totalNodos;
    private long tiempoRestanteHalfOpenSegundos;
    private String ultimoCambioEstado;
    private String mensaje;
    private Map<String, Boolean> detalleNodos;
}
