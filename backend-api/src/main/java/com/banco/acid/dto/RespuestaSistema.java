package com.banco.acid.dto;

import lombok.*;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RespuestaSistema<T> {

    private boolean exito;
    private String mensaje;
    private String nodoEjecutor;
    private String txGuid;
    private T datos;
    private LocalDateTime timestamp;

    public static <T> RespuestaSistema<T> ok(String mensaje, String nodoEjecutor, String txGuid, T datos) {
        return RespuestaSistema.<T>builder()
                .exito(true)
                .mensaje(mensaje)
                .nodoEjecutor(nodoEjecutor)
                .txGuid(txGuid)
                .datos(datos)
                .timestamp(LocalDateTime.now())
                .build();
    }

    public static <T> RespuestaSistema<T> error(String mensaje, String nodoEjecutor, String txGuid, T datos) {
        return RespuestaSistema.<T>builder()
                .exito(false)
                .mensaje(mensaje)
                .nodoEjecutor(nodoEjecutor)
                .txGuid(txGuid)
                .datos(datos)
                .timestamp(LocalDateTime.now())
                .build();
    }
}
