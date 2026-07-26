package com.banco.acid.repository;

import com.banco.acid.model.BitacoraWal;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface BitacoraWalRepository extends JpaRepository<BitacoraWal, Integer> {

    List<BitacoraWal> findByTxGuidOrderByIdAsc(String txGuid);

    List<BitacoraWal> findTop50ByOrderByIdDesc();
}
