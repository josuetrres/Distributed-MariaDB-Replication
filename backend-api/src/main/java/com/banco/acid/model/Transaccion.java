package com.banco.acid.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "transacciones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Transaccion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "tx_guid", nullable = false, unique = true, length = 64)
    private String txGuid;

    @Column(name = "cuenta_origen_id", nullable = false)
    private Integer cuentaOrigenId;

    @Column(name = "cuenta_destino_id", nullable = false)
    private Integer cuentaDestinoId;

    @Column(nullable = false, precision = 15, scale = 2)
    private BigDecimal monto;

    @Column(nullable = false, length = 20)
    private String estado; // PENDIENTE, COMPLETADA, REVERTIDA, FALLIDA

    @Column(name = "nivel_aislamiento", length = 30)
    private String nivelAislamiento;

    @Column(name = "error_simulado")
    private Boolean errorSimulado;

    @Column(name = "nodo_ejecutor", nullable = false, length = 50)
    private String nodoEjecutor;

    @Column(length = 255)
    private String mensaje;

    @Column(name = "fecha_registro", insertable = false, updatable = false)
    private LocalDateTime fechaRegistro;
}
