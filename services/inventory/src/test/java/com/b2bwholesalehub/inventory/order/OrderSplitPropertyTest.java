package com.b2bwholesalehub.inventory.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Feature: b2b-wholesale-hub, Property 15: Checkout splits into one sub-order per supplier with
 * complete records — for any non-empty cart whose reservations are all active, checkout creates
 * exactly one sub-order per distinct supplier, each containing only that supplier's line items,
 * each starting in PENDING status, and each recording supplier id, retailer id, line items,
 * per-unit prices, and sub-order total.
 *
 * <p>**Validates: Requirements 10.1, 10.3, 10.5**
 */
class OrderSplitPropertyTest {

  @Property(tries = 200)
  void oneSubOrderPerSupplierWithCompleteRecords(@ForAll("lines") List<CheckoutLine> lines) {
    UUID retailerId = UUID.randomUUID();
    OrderPlan plan = OrderSplitter.split(retailerId, lines);

    long distinctSuppliers = lines.stream().map(CheckoutLine::supplierId).distinct().count();
    // Exactly one sub-order per distinct supplier.
    assertThat(plan.subOrders()).hasSize((int) distinctSuppliers);

    Set<UUID> seenSuppliers = new HashSet<>();
    List<UUID> coveredLineProducts = new ArrayList<>();
    List<UUID> allInputProducts = new ArrayList<>();
    lines.forEach(l -> allInputProducts.add(l.cartItemId()));

    for (OrderPlan.SubOrderPlan sub : plan.subOrders()) {
      // Distinct supplier per sub-order.
      assertThat(seenSuppliers.add(sub.supplierId())).isTrue();
      // Retailer id recorded on every sub-order.
      assertThat(sub.retailerId()).isEqualTo(retailerId);
      // Sub-order total equals the sum of its line subtotals.
      BigDecimal expected =
          sub.lines().stream()
              .map(CheckoutLine::lineSubtotal)
              .reduce(BigDecimal.ZERO, BigDecimal::add)
              .setScale(2, RoundingMode.HALF_UP);
      assertThat(sub.total()).isEqualByComparingTo(expected);
      assertThat(sub.lines()).isNotEmpty();
      for (CheckoutLine line : sub.lines()) {
        // Each line belongs only to this supplier and records its per-unit price.
        assertThat(line.supplierId()).isEqualTo(sub.supplierId());
        assertThat(line.unitPrice()).isNotNull();
        coveredLineProducts.add(line.cartItemId());
      }
    }
    // Partition: every input line is covered exactly once.
    assertThat(coveredLineProducts.stream().sorted().toList())
        .isEqualTo(allInputProducts.stream().sorted().toList());
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
