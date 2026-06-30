package com.b2bwholesalehub.inventory.cart;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * A cart partitioned by supplier for display and checkout. The combined {@link #total} is the sum
 * of all per-supplier subtotals, which in turn are the sums of their line subtotals. (Req 9.4, 9.5,
 * 9.6)
 *
 * @param suppliers one group per distinct supplier, each with its own subtotal
 * @param total the combined cart total in BDT
 */
public record GroupedCart(List<SupplierGroup> suppliers, BigDecimal total) {

  /**
   * One supplier's portion of the cart.
   *
   * @param supplierId the supplier
   * @param lines that supplier's line items
   * @param subtotal the sum of that supplier's line subtotals in BDT
   */
  public record SupplierGroup(UUID supplierId, List<CartLine> lines, BigDecimal subtotal) {}
}
