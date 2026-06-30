package com.b2bwholesalehub.inventory.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Feature: b2b-wholesale-hub, Property 16: Parent order total equals the sum of sub-order totals —
 * for any successful checkout, the parent order total equals the sum of all sub-order totals
 * (rounded half-up to 2 decimals), and each sub-order total equals the sum of its line subtotals.
 *
 * <p>**Validates: Requirements 10.2**
 */
class OrderTotalPropertyTest {

  @Property(tries = 200)
  void parentTotalEqualsSumOfSubOrderTotals(@ForAll("lines") List<CheckoutLine> lines) {
    OrderPlan plan = OrderSplitter.split(UUID.randomUUID(), lines);

    BigDecimal sumOfSubOrders =
        plan.subOrders().stream()
            .map(OrderPlan.SubOrderPlan::total)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    assertThat(plan.orderTotal()).isEqualByComparingTo(sumOfSubOrders);
    assertThat(plan.orderTotal().scale()).isEqualTo(2);

    for (OrderPlan.SubOrderPlan sub : plan.subOrders()) {
      BigDecimal sumOfLines =
          sub.lines().stream()
              .map(CheckoutLine::lineSubtotal)
              .reduce(BigDecimal.ZERO, BigDecimal::add)
              .setScale(2, RoundingMode.HALF_UP);
      assertThat(sub.total()).isEqualByComparingTo(sumOfLines);
    }
  }

  @Provide
  Arbitrary<List<CheckoutLine>> lines() {
    List<UUID> supplierPool = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
    Arbitrary<Integer> supplierIdx = Arbitraries.integers().between(0, supplierPool.size() - 1);
    Arbitrary<Integer> qty = Arbitraries.integers().between(1, 1000);
    Arbitrary<Long> priceCents = Arbitraries.longs().between(1L, 99_999_999L);
    Arbitrary<CheckoutLine> line =
        Combinators.combine(supplierIdx, qty, priceCents)
            .as(
                (idx, q, cents) -> {
                  BigDecimal unit = BigDecimal.valueOf(cents, 2);
                  BigDecimal subtotal =
                      unit.multiply(BigDecimal.valueOf(q)).setScale(2, RoundingMode.HALF_UP);
                  return new CheckoutLine(
                      UUID.randomUUID(),
                      UUID.randomUUID(),
                      supplierPool.get(idx),
                      q,
                      unit,
                      subtotal,
                      UUID.randomUUID().toString());
                });
    return line.list().ofMinSize(1).ofMaxSize(20);
  }
}
