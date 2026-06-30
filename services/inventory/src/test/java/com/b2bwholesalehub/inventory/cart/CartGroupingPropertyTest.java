package com.b2bwholesalehub.inventory.cart;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
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
 * Feature: b2b-wholesale-hub, Property 14: Multi-vendor cart grouping is a correct partition by
 * supplier — grouping line items by supplier yields a partition: every line item belongs to exactly
 * one supplier group, and the union of all groups equals the original set of line items with no
 * duplicates or omissions.
 *
 * <p>**Validates: Requirements 9.4**
 */
class CartGroupingPropertyTest {

  @Property(tries = 200)
  void groupingIsACorrectPartition(@ForAll("lines") List<CartLine> lines) {
    GroupedCart grouped = CartGrouping.group(lines);

    // Every line appears exactly once across all groups (by id): union == input, no dup/omission.
    List<UUID> groupedIds = new ArrayList<>();
    Set<UUID> supplierKeys = new HashSet<>();
    for (GroupedCart.SupplierGroup group : grouped.suppliers()) {
      // No supplier appears in two groups (each group is for a distinct supplier).
      assertThat(supplierKeys.add(group.supplierId())).isTrue();
      for (CartLine line : group.lines()) {
        // Every line in a group really belongs to that supplier.
        assertThat(line.supplierId()).isEqualTo(group.supplierId());
        groupedIds.add(line.id());
      }
    }

    List<UUID> inputIds = lines.stream().map(CartLine::id).sorted().toList();
    assertThat(groupedIds.stream().sorted().toList()).isEqualTo(inputIds);
    // Number of groups equals number of distinct suppliers in the input.
    long distinctSuppliers = lines.stream().map(CartLine::supplierId).distinct().count();
    assertThat(grouped.suppliers()).hasSize((int) distinctSuppliers);
  }

  @Provide
  Arbitrary<List<CartLine>> lines() {
    // A small pool of supplier ids so multiple lines share suppliers (multi-vendor carts).
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
                      unit.multiply(BigDecimal.valueOf(q))
                          .setScale(2, java.math.RoundingMode.HALF_UP);
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
