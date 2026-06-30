package com.b2bwholesalehub.inventory;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Inventory Service entry point — the transactional core of B2B-Wholesale-Hub.
 *
 * <p>Java 21 + Spring Boot 3. All money is {@link java.math.BigDecimal} backed by {@code
 * NUMERIC(12,2)} columns and computed with {@link java.math.RoundingMode#HALF_UP}.
 */
@SpringBootApplication
@EnableScheduling
public class InventoryApplication {

  public static void main(String[] args) {
    SpringApplication.run(InventoryApplication.class, args);
  }
}
