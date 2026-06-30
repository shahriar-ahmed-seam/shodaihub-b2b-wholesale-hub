package com.b2bwholesalehub.inventory;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * Boots the full Inventory Service against a real PostgreSQL container: Flyway applies the {@code
 * inventory} schema, Hibernate validates the JPA mappings against it, and the readiness probe is
 * exercised end-to-end. (Req 20.1; task 4.1)
 *
 * <p>Guarded with {@code disabledWithoutDocker = true}: when no Docker daemon is available the test
 * is skipped gracefully so the pure unit/property suite still runs in CI environments without
 * containers.
 */
@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class InventoryFoundationIntegrationTest {

  @Container
  static final PostgreSQLContainer<?> POSTGRES =
      new PostgreSQLContainer<>("postgres:16-alpine")
          .withDatabaseName("inventory")
          .withUsername("inventory")
          .withPassword("inventory");

  @DynamicPropertySource
  static void datasourceProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
    registry.add("spring.datasource.username", POSTGRES::getUsername);
    registry.add("spring.datasource.password", POSTGRES::getPassword);
  }

  @Autowired private TestRestTemplate restTemplate;

  @Test
  @SuppressWarnings("unchecked")
  void healthEndpointReportsUpWithMigratedSchema() {
    ResponseEntity<java.util.Map> response =
        restTemplate.getForEntity("/inventory/health", java.util.Map.class);
    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).containsEntry("status", "UP");
  }
}
