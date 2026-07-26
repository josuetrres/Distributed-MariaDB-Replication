package com.banco.acid.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TransferenciaRequest {

    @NotNull(message = "La cuenta de origen es obligatoria")
    private Integer cuentaOrigenId;

    @NotNull(message = "La cuenta de destino es obligatoria")
    private Integer cuentaDestinoId;

    @NotNull(message = "El monto es obligatorio")
    @DecimalMin(value = "0.01", message = "El monto a transferir debe ser mayor a 0")
    private BigDecimal monto;

    private String nivelAislamiento; // READ_COMMITTED, REPEATABLE_READ, SERIALIZABLE

    private boolean simularError; // Si es true, provoca una excepción deliberada durante la ejecución para probar el proceso UNDO (rollback)
}
