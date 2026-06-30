package com.b2bwholesalehub.inventory.order;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Pure cart-to-order splitting. No database, no Spring — directly unit- and property-testable.
 *
 * <p>Partitions the cart's lines by supplier into exactly one sub-order per distinct supplier, each
 * containing only that supplier's lines (Property 15). Each sub-order total is the sum of its line
 * subtotals, and the parent order total is the sum of the sub-order totals, both half-up to 2
 * decimals (Property 16). (Req 10.1, 10.2, 10.5)
 */
public final class OrderSplitter {

  private OrderSplitter() {}

  /** Splits the given checkout lines for a retailer into a parent order plan. */
  public static OrderPlan split(UUID retailerId, List<CheckoutLine> lines) {
    Map<UUID, List<CheckoutLine>> bySupplier = new LinkedHashMap<>();
    for (CheckoutLine line : lines) {
      bySupplier.computeIfAbsent(line.supplierId(), k -> new ArrayList<>()).add(line);
    }

    List<OrderPlan.SubOrderPlan> subOrders = new ArrayList<>();
    BigDecimal orderTotal = BigDecimal.ZERO;
    for (Map.Entry<UUID, List<CheckoutLine>> entry : bySupplier.entrySet()) {
      BigDecimal subtotal = sumLineSubtotals(entry.getValue());
      subOrders.add(
          new OrderPlan.SubOrderPlan(
              entry.getKey(), retailerId, subtotal, List.copyOf(entry.getValue())));
      orderTotal = orderTotal.add(subtotal);
    }
    return new OrderPlan(retailerId, orderTotal.setScale(Money.SCALE, Money.ROUNDING), subOrders);
  }

  private static BigDecimal sumLineSubtotals(List<CheckoutLine> lines) {
    BigDecimal sum = BigDecimal.ZERO;
    for (CheckoutLine line : lines) {
      sum = sum.add(line.lineSubtotal());
    }
    return sum.setScale(Money.SCALE, Money.ROUNDING);
  }
}
