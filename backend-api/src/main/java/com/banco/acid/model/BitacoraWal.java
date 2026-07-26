package com.banco.acid.model;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "bitacora_wal")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BitacoraWal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(name = "tx_guid", nullable = false, length = 64)
    private String txGuid;

    @Column(name = "fase_wal", nullable = false, length = 30)
    private String faseWal; // INICIADA, WAL_GRABADO_BUFFER, REDO_PREPARADO, UNDO_REGISTRADO, COMMIT_FLUSH, ROLLBACK_EJECUTADO

    @Column(name = "cuenta_origen_id")
    private Integer cuentaOrigenId;

    @Column(name = "cuenta_destino_id")
    private Integer cuentaDestinoId;

    @Column(precision = 15, scale = 2)
    private BigDecimal monto;

    @Column(name = "saldo_origen_anterior", precision = 15, scale = 2)
    private BigDecimal saldoOrigenAnterior;

    @Column(name = "saldo_origen_nuevo", precision = 15, scale = 2)
    private BigDecimal saldoOrigenNuevo;

    @Column(name = "saldo_destino_anterior", precision = 15, scale = 2)
    private BigDecimal saldoDestinoAnterior;

    @Column(name = "saldo_destino_nuevo", precision = 15, scale = 2)
    private BigDecimal saldoDestinoNuevo;

    @Column(length = 255)
    private String detalles;

    @Column(name = "fecha_log", insertable = false, updatable = false)
    private LocalDateTime fechaLog;
}
