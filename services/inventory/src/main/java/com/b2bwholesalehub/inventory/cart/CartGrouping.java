package com.b2bwholesalehub.inventory.cart;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pure multi-vendor cart grouping and totalling. No database, no Spring — directly unit- and
 * property-testable.
 *
 * <p>Grouping line items by supplier yields a partition: every line belongs to exactly one supplier
 * group and the union of all groups equals the original set of lines, with no duplicates or
 * omissions (Property 14). The combined total equals the sum of all line subtotals, and each
 * per-supplier subtotal equals the sum of that supplier's line subtotals (Property 12). (Req 9.4,
 * 9.5)
 */
public final class CartGrouping {

  private CartGrouping() {}

  /** Partitions the lines by supplier (insertion order preserved) and computes all totals. */
  public static GroupedCart group(List<CartLine> lines) {
    Map<UUID, List<CartLine>> bySupplier = new LinkedHashMap<>();
    for (CartLine line : lines) {
      bySupplier.computeIfAbsent(line.supplierId(), k -> new ArrayList<>()).add(line);
    }

    List<GroupedCart.SupplierGroup> groups = new ArrayList<>();
    BigDecimal total = BigDecimal.ZERO.setScale(Money.SCALE, Money.ROUNDING);
    for (Map.Entry<UUID, List<CartLine>> entry : bySupplier.entrySet()) {
      BigDecimal subtotal = sumSubtotals(entry.getValue());
      groups.add(
          new GroupedCart.SupplierGroup(entry.getKey(), List.copyOf(entry.getValue()), subtotal));
      total = total.add(subtotal);
    }
    return new GroupedCart(groups, total.setScale(Money.SCALE, Money.ROUNDING));
  }

  /** Sum of the line subtotals, normalized to 2 decimals. */
  public static BigDecimal sumSubtotals(List<CartLine> lines) {
    BigDecimal sum = BigDecimal.ZERO;
    for (CartLine line : lines) {
      sum = sum.add(line.subtotal());
    }
    return sum.setScale(Money.SCALE, Money.ROUNDING);
  }
}
