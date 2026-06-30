package com.b2bwholesalehub.inventory.admin;

import com.b2bwholesalehub.inventory.event.ProductIndexEvent;
import com.b2bwholesalehub.inventory.product.ProductStatus;

/**
 * Pure administrative product-removal rule. No database, no Spring — directly unit- and
 * property-testable.
 *
 * <p>Removing a product, regardless of its prior status, sets the status to REMOVED and requires a
 * search-index removal (de-index) event (Property 39). (Req 16.4)
 */
public final class AdminProductRemoval {

  private AdminProductRemoval() {}

  /**
   * The outcome of removing a product.
   *
   * @param status the resulting status (always REMOVED)
   * @param indexOp the search-index operation to emit (always DELETE / de-index)
   */
  public record Result(ProductStatus status, ProductIndexEvent.Op indexOp) {}

  /** Computes the removal outcome for a product currently in {@code current} status. */
  public static Result remove(ProductStatus current) {
    return new Result(ProductStatus.REMOVED, ProductIndexEvent.Op.DELETE);
  }
}
