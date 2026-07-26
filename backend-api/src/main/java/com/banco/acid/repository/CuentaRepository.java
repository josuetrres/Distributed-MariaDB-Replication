package com.banco.acid.repository;

import com.banco.acid.model.Cuenta;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Optional;

@Repository
public interface CuentaRepository extends JpaRepository<Cuenta, Integer> {

    Optional<Cuenta> findByNumeroCuenta(String numeroCuenta);

    // Búsqueda con bloqueo pesimista de fila (SELECT ... FOR UPDATE) para garantías de Aislamiento (Isolation)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT c FROM Cuenta c WHERE c.id = :id")
    Optional<Cuenta> findByIdForUpdate(Integer id);

    // Consulta de la suma total del dinero circulante para verificar la Invariante de Consistencia (Consistency)
    @Query("SELECT SUM(c.saldo) FROM Cuenta c")
    BigDecimal obtenerSaldoTotalSistema();
}
