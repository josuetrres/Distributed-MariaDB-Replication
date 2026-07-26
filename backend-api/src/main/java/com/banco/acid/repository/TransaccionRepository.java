package com.banco.acid.repository;

import com.banco.acid.model.Transaccion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TransaccionRepository extends JpaRepository<Transaccion, Integer> {

    Optional<Transaccion> findByTxGuid(String txGuid);

    List<Transaccion> findTop50ByOrderByIdDesc();
}
