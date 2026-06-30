package com.b2bwholesalehub.inventory.cart;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.pricing.PriceResolver;
import com.b2bwholesalehub.inventory.pricing.TierRange;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 11: MOQ enforcement on cart add — for any product with
 * minimum order quantity MOQ and any requested quantity q, adding to cart is permitted with a
 * correctly resolved per-unit price and subtotal if and only if q &gt;= MOQ; otherwise it is
 * rejected (and the required MOQ is what the caller is told).
 *
 * <p>**Validates: Requirements 9.1, 9.2**
 */
class MoqEnforcementPropertyTest {

  @Property(tries = 200)
  void addPermittedIffQuantityMeetsMoqAndResolvesCorrectly(
      @ForAll @IntRange(min = 1, max = 1000) int moq,
      @ForAll @IntRange(min = 1, max = 2000) int quantity,
      @ForAll("basePrice") BigDecimal basePrice,
      @ForAll("tiers") List<TierRange> tiers) {

    boolean permitted = CartLineMath.meetsMoq(quantity, moq);
    assertThat(permitted).isEqualTo(quantity >= moq);

    // On the permitted path the resolved price/subtotal match the tiered-pricing algorithm.
    if (permitted) {
      CartLineMath.Resolved resolved = CartLineMath.resolve(basePrice, tiers, quantity);
      BigDecimal expectedUnit = PriceResolver.resolveUnitPrice(basePrice, tiers, quantity);
      BigDecimal expectedSubtotal =
          expectedUnit.multiply(BigDecimal.valueOf(quantity)).setScale(2, RoundingMode.HALF_UP);
      assertThat(resolved.unitPrice()).isEqualByComparingTo(expectedUnit);
      assertThat(resolved.subtotal()).isEqualByComparingTo(expectedSubtotal);
      assertThat(resolved.subtotal().scale()).isEqualTo(2);
    }
  }

  @Provide
  Arbitrary<BigDecimal> basePrice() {
    return Arbitraries.longs().between(1L, 99_999_999L).map(c -> BigDecimal.valueOf(c, 2));
  }

  @Provide
  Arbitrary<List<TierRange>> tiers() {
    Arbitrary<Integer> min = Arbitraries.integers().between(1, 2000);
    Arbitrary<Integer> width = Arbitraries.integers().between(0, 300);
    Arbitrary<BigDecimal> price =
        Arbitraries.longs().between(1L, 99_999_999L).map(c -> BigDecimal.valueOf(c, 2));
    return Combinators.combine(min, width, price)
        .as((m, w, p) -> new TierRange(m, m + w, p))
        .list()
        .ofMaxSize(4);
  }
}
