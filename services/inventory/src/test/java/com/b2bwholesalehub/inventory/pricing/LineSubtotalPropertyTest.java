package com.b2bwholesalehub.inventory.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.math.RoundingMode;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 2: Line subtotal is unit price times quantity, rounded
 * half-up — for any resolved per-unit price and positive integer quantity, the line subtotal equals
 * (unitPrice × quantity) rounded half-up to exactly 2 decimal places.
 *
 * <p>**Validates: Requirements 5.8**
 */
class LineSubtotalPropertyTest {

  @Property(tries = 200)
  void subtotalIsUnitPriceTimesQuantityHalfUp(
      @ForAll("unitPrices") BigDecimal unitPrice,
      @ForAll @IntRange(min = 1, max = 100000) int qty) {

    BigDecimal expected =
        unitPrice.multiply(BigDecimal.valueOf(qty)).setScale(Money.SCALE, RoundingMode.HALF_UP);

    BigDecimal actual = Money.lineSubtotal(unitPrice, qty);

    assertThat(actual).isEqualByComparingTo(expected);
    assertThat(actual.scale()).isEqualTo(Money.SCALE);
  }

  /** Prices possibly carrying more than 2 decimals, so HALF_UP rounding is genuinely exercised. */
  @Provide
  Arbitrary<BigDecimal> unitPrices() {
    return Arbitraries.longs()
        .between(1L, 9_999_999_999L)
        .map(units -> BigDecimal.valueOf(units, 4));
  }
}
