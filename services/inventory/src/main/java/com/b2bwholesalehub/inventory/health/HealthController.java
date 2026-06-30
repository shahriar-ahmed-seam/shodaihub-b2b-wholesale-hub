package com.b2bwholesalehub.inventory.health;

import java.util.Map;
import javax.sql.DataSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Readiness probe at {@code GET /inventory/health}. Reports the service as ready only when a
 * database connection can be validated. (Req 20.1)
 */
@RestController
public class HealthController {

  private final DataSource dataSource;

  public HealthController(DataSource dataSource) {
    this.dataSource = dataSource;
  }

  @GetMapping("/inventory/health")
  public ResponseEntity<Map<String, String>> health() {
    boolean dbUp = checkDatabase();
    if (dbUp) {
      return ResponseEntity.ok(Map.of("status", "UP", "db", "UP"));
    }
    return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(Map.of("status", "DOWN", "db", "DOWN"));
  }

  private boolean checkDatabase() {
    try (var connection = dataSource.getConnection()) {
      return connection.isValid(2);
    } catch (Exception ex) {
      return false;
    }
  }
}
