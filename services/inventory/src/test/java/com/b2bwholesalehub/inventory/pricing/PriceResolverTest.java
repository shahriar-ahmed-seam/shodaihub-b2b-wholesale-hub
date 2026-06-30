package com.b2bwholesalehub.inventory.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Example-based tests for price resolution and subtotal rounding. (Req 5.6, 5.7, 5.8) */
class PriceResolverTest {

  private final BigDecimal base = new BigDecimal("100.00");
  private final List<TierRange> tiers =
      List.of(
          new TierRange(1, 9, new BigDecimal("100.00")),
          new TierRange(10, 49, new BigDecimal("90.00")),
          new TierRange(50, 100, new BigDecimal("80.00")));

  @Test
  void resolvesBoundaryInclusive() {
    assertThat(PriceResolver.resolveUnitPrice(base, tiers, 10)).isEqualByComparingTo("90.00");
    assertThat(PriceResolver.resolveUnitPrice(base, tiers, 49)).isEqualByComparingTo("90.00");
    assertThat(PriceResolver.resolveUnitPrice(base, tiers, 50)).isEqualByComparingTo("80.00");
    assertThat(PriceResolver.resolveUnitPrice(base, tiers, 100)).isEqualByComparingTo("80.00");
  }

  @Test
  void resolvesBaseWhenOutsideAllTiers() {
    assertThat(PriceResolver.resolveUnitPrice(base, tiers, 101)).isEqualByComparingTo("100.00");
    assertThat(PriceResolver.resolveUnitPrice(base, List.of(), 5)).isEqualByComparingTo("100.00");
  }

  @Test
  void subtotalRoundsHalfUpToTwoDecimals() {
    // 0.125 * 1 = 0.125 -> 0.13 (half-up)
    assertThat(Money.lineSubtotal(new BigDecimal("0.125"), 1)).isEqualByComparingTo("0.13");
    // 90.00 * 12 = 1080.00
    assertThat(PriceResolver.lineSubtotal(base, tiers, 12)).isEqualByComparingTo("1080.00");
    assertThat(Money.lineSubtotal(new BigDecimal("0.125"), 1).scale()).isEqualTo(2);
  }
}
