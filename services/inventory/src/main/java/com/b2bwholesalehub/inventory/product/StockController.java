package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.Identity;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Stock management endpoint. (Req 6.1, 6.2, 6.3) */
@RestController
public class StockController {

  /** Stock-update payload. */
  public record StockRequest(int availableStock) {}

  private final StockService stockService;

  public StockController(StockService stockService) {
    this.stockService = stockService;
  }

  @PutMapping("/products/{id}/stock")
  public ResponseEntity<Product> setStock(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @PathVariable UUID id,
      @RequestBody StockRequest request) {
    return ResponseEntity.ok(stockService.setStock(userId, id, request.availableStock()));
  }
}
