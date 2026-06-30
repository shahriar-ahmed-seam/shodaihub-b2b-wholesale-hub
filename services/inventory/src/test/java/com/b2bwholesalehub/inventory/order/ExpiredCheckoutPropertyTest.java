package com.b2bwholesalehub.inventory.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
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
 * Feature: b2b-wholesale-hub, Property 17: Expired reservation halts checkout without side effects
 * — for any cart in which at least one line item's reservation has expired at checkout time,
 * checkout is halted, no sub-orders or parent order are created, the cart contents are left
 * unchanged, and the response identifies each affected line item.
 *
 * <p>**Validates: Requirements 10.4**
 */
class ExpiredCheckoutPropertyTest {

  @Property(tries = 200)
  void expiredReservationHaltsWithoutPlanAndNamesAffected(
      @ForAll("lines") List<CheckoutLine> lines, @ForAll("inactiveCount") int rawInactiveCount) {

    int inactiveCount = Math.min(rawInactiveCount, lines.size());
    // Mark the first `inactiveCount` lines' reservations as inactive (expired).
    Set<String> inactive = new HashSet<>();
    for (int i = 0; i < inactiveCount; i++) {
      inactive.add(lines.get(i).reservationId());
    }

    CheckoutPlanner.Outcome outcome =
        CheckoutPlanner.plan(
            UUID.randomUUID(), lines, line -> !inactive.contains(line.reservationId()));

    if (inactiveCount > 0) {
      // Halted: no plan (so no parent order / sub-orders created).
      assertThat(outcome.halted()).isTrue();
      assertThat(outcome.plan()).isNull();
      // Every affected line is identified, and only the affected ones.
      Set<UUID> affectedIds = new HashSet<>();
      outcome.affected().forEach(l -> affectedIds.add(l.cartItemId()));
      Set<UUID> expectedIds = new HashSet<>();
      lines.stream()
          .filter(l -> inactive.contains(l.reservationId()))
          .forEach(l -> expectedIds.add(l.cartItemId()));
      assertThat(affectedIds).isEqualTo(expectedIds);
      assertThat(outcome.affected()).hasSize(inactiveCount);
    } else {
      // All active: a plan is produced and totals are well-formed.
      assertThat(outcome.halted()).isFalse();
      assertThat(outcome.plan()).isNotNull();
      BigDecimal expectedTotal =
          lines.stream()
              .map(CheckoutLine::lineSubtotal)
              .reduce(BigDecimal.ZERO, BigDecimal::add)
              .setScale(2, RoundingMode.HALF_UP);
      assertThat(outcome.plan().orderTotal()).isEqualByComparingTo(expectedTotal);
    }
  }

  @Provide
  Arbitrary<Integer> inactiveCount() {
    return Arbitraries.integers().between(0, 20);
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
