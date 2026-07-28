package com.banco.acid.service;

import com.banco.acid.dto.CircuitBreakerStatusDTO;
import com.banco.acid.model.CircuitBreakerState;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@Slf4j
public class CircuitBreakerService {

    private static final int UBRAL_MINIMO_NODOS = 2;
    private static final long COOLDOWN_MS = 15000L; // 15 segundos

    @Value("${PC1_IP:${pc1.ip:127.0.0.1}}")
    private String pc1Ip;

    @Value("${PC2_IP:${pc2.ip:127.0.0.1}}")
    private String pc2Ip;

    @Value("${PC3_IP:${pc3.ip:127.0.0.1}}")
    private String pc3Ip;

    @Value("${server.port:8081}")
    private String serverPort;

    private CircuitBreakerState estadoActual = CircuitBreakerState.CLOSED;
    private long timestampUltimoCambio = System.currentTimeMillis();
    private int ultimosNodosActivosCount = 3;
    private final Map<String, Boolean> ultimoDetalleNodos = new HashMap<>();

    private final RestTemplate restTemplate;

    public CircuitBreakerService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(1000);
        factory.setReadTimeout(1000);
        this.restTemplate = new RestTemplate(factory);
        
        ultimoDetalleNodos.put("Nodo 1 (PC1)", true);
        ultimoDetalleNodos.put("Nodo 2 (PC2)", true);
        ultimoDetalleNodos.put("Nodo 3 (PC3)", true);
    }

    /**
     * Tarea programada cada 3 segundos para monitorear la salud de los 3 nodos en la red.
     */
    @Scheduled(fixedRate = 3000)
    public synchronized void evaluarSaludNodosYEstado() {
        Map<String, Boolean> detalle = verificarSaludNodos();
        int nodosActivos = (int) detalle.values().stream().filter(Boolean::booleanValue).count();
        this.ultimosNodosActivosCount = nodosActivos;
        this.ultimoDetalleNodos.clear();
        this.ultimoDetalleNodos.putAll(detalle);

        long ahora = System.currentTimeMillis();
        long transcurridoMs = ahora - timestampUltimoCambio;

        switch (estadoActual) {
            case CLOSED:
                if (nodosActivos < UBRAL_MINIMO_NODOS) {
                    estadoActual = CircuitBreakerState.OPEN;
                    timestampUltimoCambio = ahora;
                    log.warn("Circuit Breaker paso a OPEN! Nodos activos: {} < {}", nodosActivos, UBRAL_MINIMO_NODOS);
                }
                break;

            case OPEN:
                if (transcurridoMs >= COOLDOWN_MS) {
                    estadoActual = CircuitBreakerState.HALF_OPEN;
                    timestampUltimoCambio = ahora;
                    log.info("Circuit Breaker transiciono a HALF_OPEN tras 15s de cooldown. Evaluando recuperacion...");
                }
                break;

            case HALF_OPEN:
                if (nodosActivos >= UBRAL_MINIMO_NODOS) {
                    estadoActual = CircuitBreakerState.CLOSED;
                    timestampUltimoCambio = ahora;
                    log.info("Circuit Breaker paso a CLOSED! Recuperacion exitosa con {} nodos activos.", nodosActivos);
                } else {
                    estadoActual = CircuitBreakerState.OPEN;
                    timestampUltimoCambio = ahora;
                    log.warn("Circuit Breaker reabrio a OPEN! Solo {} nodo(s) activo(s). Reiniciando temporizador 15s.", nodosActivos);
                }
                break;
        }
    }

    private Map<String, Boolean> verificarSaludNodos() {
        Map<String, Boolean> res = new HashMap<>();

        String localPort = (serverPort != null && !serverPort.isBlank()) ? serverPort : "8081";

        // Evaluar Nodo 1 (PC1:8081)
        res.put("Nodo 1 (PC1)", pingConFallback("http://" + pc1Ip + ":8081/api/v1/metricas/nodo", "http://127.0.0.1:" + localPort + "/api/v1/metricas/nodo"));

        // Evaluar Nodo 2 (PC2:8082)
        res.put("Nodo 2 (PC2)", pingConFallback("http://" + pc2Ip + ":8082/api/v1/metricas/nodo", "http://127.0.0.1:" + localPort + "/api/v1/metricas/nodo"));

        // Evaluar Nodo 3 (PC3:8083)
        res.put("Nodo 3 (PC3)", pingConFallback("http://" + pc3Ip + ":8083/api/v1/metricas/nodo", "http://127.0.0.1:" + localPort + "/api/v1/metricas/nodo"));

        return res;
    }

    private boolean pingConFallback(String urlPrincipal, String urlFallbackLocal) {
        if (pingNodo(urlPrincipal)) {
            return true;
        }
        // Si el puerto de la URL coincide con el puerto local, intentar fallback a 127.0.0.1
        if (urlPrincipal != null && urlPrincipal.contains(":" + serverPort + "/") && urlFallbackLocal != null) {
            return pingNodo(urlFallbackLocal);
        }
        return false;
    }

    private boolean pingNodo(String url) {
        try {
            var response = restTemplate.getForEntity(url, String.class);
            return response.getStatusCode().is2xxSuccessful();
        } catch (Exception e) {
            return false;
        }
    }

    public synchronized boolean permiteTrafico() {
        // En OPEN se bloquea el tráfico de transacciones/escritura
        return estadoActual != CircuitBreakerState.OPEN;
    }

    public synchronized CircuitBreakerStatusDTO obtenerEstado() {
        long ahora = System.currentTimeMillis();
        long transcurridoMs = ahora - timestampUltimoCambio;
        long restanteSegundos = 0;

        if (estadoActual == CircuitBreakerState.OPEN) {
            long restanteMs = COOLDOWN_MS - transcurridoMs;
            restanteSegundos = Math.max(0, (restanteMs + 999) / 1000);
        }

        String msg;
        switch (estadoActual) {
            case CLOSED:
                msg = String.format("Circuit Breaker CERRADO: %d/3 nodos activos. Operación normal.", ultimosNodosActivosCount);
                break;
            case OPEN:
                msg = String.format("Circuit Breaker ABIERTO: Solo %d/3 nodo(s) activo(s) (Mínimo requerido: %d). Transacciones bloqueadas.", ultimosNodosActivosCount, UBRAL_MINIMO_NODOS);
                break;
            case HALF_OPEN:
                msg = String.format("Circuit Breaker SEMI-ABIERTO (HALF-OPEN): Probando recuperacion de nodos (%d/3 activos).", ultimosNodosActivosCount);
                break;
            default:
                msg = "Estado desconocido";
        }

        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm:ss");
        String horaUltimoCambio = LocalDateTime.now().format(formatter);

        return CircuitBreakerStatusDTO.builder()
                .estado(estadoActual)
                .nodosActivos(ultimosNodosActivosCount)
                .totalNodos(3)
                .tiempoRestanteHalfOpenSegundos(restanteSegundos)
                .ultimoCambioEstado(horaUltimoCambio)
                .mensaje(msg)
                .detalleNodos(new HashMap<>(ultimoDetalleNodos))
                .build();
    }
}
