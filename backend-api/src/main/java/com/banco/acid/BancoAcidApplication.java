package com.banco.acid;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class BancoAcidApplication {

    public static void main(String[] args) {
        SpringApplication.run(BancoAcidApplication.class, args);
    }
}
