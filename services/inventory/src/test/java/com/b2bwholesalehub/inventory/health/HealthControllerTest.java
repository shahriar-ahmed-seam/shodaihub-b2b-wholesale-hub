package com.b2bwholesalehub.inventory.health;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * Tests the readiness probe against real {@link javax.sql.DataSource}s (no mocks): an in-memory H2
 * connection reports UP, an unreachable database reports DOWN. (Req 20.1)
 */
class HealthControllerTest {

  @Test
  void reportsUpWhenDatabaseReachable() {
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("org.h2.Driver");
    ds.setUrl("jdbc:h2:mem:health-up;DB_CLOSE_DELAY=-1");
    ds.setUsername("sa");
    ds.setPassword("");

    ResponseEntity<Map<String, String>> response = new HealthController(ds).health();

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
    assertThat(response.getBody()).containsEntry("status", "UP").containsEntry("db", "UP");
  }

  @Test
  void reportsDownWhenDatabaseUnreachable() {
    DriverManagerDataSource ds = new DriverManagerDataSource();
    ds.setDriverClassName("org.h2.Driver");
    // Point at a server that is not running so connections fail.
    ds.setUrl("jdbc:h2:tcp://localhost:1/nonexistent");
    ds.setUsername("sa");
    ds.setPassword("");

    ResponseEntity<Map<String, String>> response = new HealthController(ds).health();

    assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
    assertThat(response.getBody()).containsEntry("status", "DOWN");
  }
}
