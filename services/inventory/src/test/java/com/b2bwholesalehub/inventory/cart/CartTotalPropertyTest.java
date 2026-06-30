package com.b2bwholesalehub.inventory.cart;

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
 * Feature: b2b-wholesale-hub, Property 12: Cart total equals the sum of line subtotals — for any
 * cart, the cart total equals the sum of all line-item subtotals, and the per-supplier subtotal
 * equals the sum of that supplier's line subtotals.
 *
 * <p>**Validates: Requirements 9.5**
 */
class CartTotalPropertyTest {

  @Property(tries = 200)
  void totalEqualsSumOfLineSubtotalsAndPerSupplierSums(@ForAll("lines") List<CartLine> lines) {
    GroupedCart grouped = CartGrouping.group(lines);

    // Combined total equals the sum of every line subtotal.
    BigDecimal expectedTotal =
        lines.stream()
            .map(CartLine::subtotal)
            .reduce(BigDecimal.ZERO, BigDecimal::add)
            .setScale(2, RoundingMode.HALF_UP);
    assertThat(grouped.total()).isEqualByComparingTo(expectedTotal);

    // Each per-supplier subtotal equals the sum of that supplier's line subtotals.
    BigDecimal sumOfGroupSubtotals = BigDecimal.ZERO;
    for (GroupedCart.SupplierGroup group : grouped.suppliers()) {
      BigDecimal expectedGroup =
          group.lines().stream()
              .map(CartLine::subtotal)
              .reduce(BigDecimal.ZERO, BigDecimal::add)
              .setScale(2, RoundingMode.HALF_UP);
      assertThat(group.subtotal()).isEqualByComparingTo(expectedGroup);
      sumOfGroupSubtotals = sumOfGroupSubtotals.add(group.subtotal());
    }
    // The total also equals the sum of the per-supplier subtotals.
    assertThat(grouped.total())
        .isEqualByComparingTo(sumOfGroupSubtotals.setScale(2, RoundingMode.HALF_UP));
  }

  @Provide
  Arbitrary<List<CartLine>> lines() {
    List<UUID> supplierPool = List.of(UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID());
    Arbitrary<Integer> supplierIdx = Arbitraries.integers().between(0, supplierPool.size() - 1);
    Arbitrary<Integer> qty = Arbitraries.integers().between(1, 1000);
    Arbitrary<Long> priceCents = Arbitraries.longs().between(1L, 99_999_999L);
    Arbitrary<CartLine> line =
        Combinators.combine(supplierIdx, qty, priceCents)
            .as(
                (idx, q, cents) -> {
                  BigDecimal unit = BigDecimal.valueOf(cents, 2);
                  BigDecimal subtotal =
                      unit.multiply(BigDecimal.valueOf(q)).setScale(2, RoundingMode.HALF_UP);
                  return new CartLine(
                      UUID.randomUUID(),
                      UUID.randomUUID(),
                      supplierPool.get(idx),
                      q,
                      unit,
                      subtotal);
                });
    return line.list().ofMinSize(0).ofMaxSize(20);
  }
}
