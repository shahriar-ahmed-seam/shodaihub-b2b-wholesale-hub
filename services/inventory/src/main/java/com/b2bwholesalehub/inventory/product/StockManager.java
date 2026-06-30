package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Pure stock-management logic. Validates that stock is a non-negative integer and computes the
 * resulting product status and whether a search-index event must be emitted.
 *
 * <p>When stock reaches zero a PUBLISHED product transitions to OUT_OF_STOCK (and the index is
 * updated); restocking an OUT_OF_STOCK product returns it to PUBLISHED. (Req 6.1, 6.2, 6.3)
 */
public final class StockManager {

  /**
   * Outcome of a stock change.
   *
   * @param stock the persisted non-negative stock value
   * @param status the resulting product status
   * @param indexEventEmitted whether the status change requires a search-index event
   */
  public record StockChangeResult(int stock, ProductStatus status, boolean indexEventEmitted) {}

  private StockManager() {}

  /** Rejects negative stock with a stock validation error. (Req 6.2) */
  public static void validateStock(int newStock) {
    if (newStock < 0) {
      throw new ApiException(
          ErrorCode.STOCK_VALIDATION_ERROR,
          HttpStatus.BAD_REQUEST,
          "Available stock must be a non-negative integer.",
          List.of(new FieldIssue("availableStock", "must be >= 0")));
    }
  }

  /**
   * Computes the result of setting a product's available stock to {@code newStock}. (Req 6.1, 6.2,
   * 6.3)
   */
  public static StockChangeResult applyStockChange(ProductStatus current, int newStock) {
    validateStock(newStock);

    ProductStatus next;
    if (newStock == 0) {
      // Only catalog-visible products flip to OUT_OF_STOCK; DRAFT/UNPUBLISHED/REMOVED are
      // unaffected.
      next =
          (current == ProductStatus.PUBLISHED || current == ProductStatus.OUT_OF_STOCK)
              ? ProductStatus.OUT_OF_STOCK
              : current;
    } else {
      // Restocking a depleted product re-publishes it.
      next = (current == ProductStatus.OUT_OF_STOCK) ? ProductStatus.PUBLISHED : current;
    }

    boolean emit = next != current;
    return new StockChangeResult(newStock, next, emit);
  }
}
