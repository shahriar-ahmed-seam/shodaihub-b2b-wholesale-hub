package com.b2bwholesalehub.inventory.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Example-based tests for pricing-tier validation. (Req 5.2, 5.3, 5.4, 5.5) */
class TierValidatorTest {

  private static TierRange tier(int min, int max, String price) {
    return new TierRange(min, max, new BigDecimal(price));
  }

  @Test
  void inclusiveRangesOverlapAtBoundary() {
    assertThat(tier(1, 10, "5.00").overlaps(tier(10, 20, "4.00"))).isTrue();
    assertThat(tier(1, 10, "5.00").overlaps(tier(11, 20, "4.00"))).isFalse();
  }

  @Test
  void overlappingCandidateRejected() {
    List<TierRange> existing = List.of(tier(1, 10, "5.00"), tier(11, 20, "4.50"));
    assertThatThrownBy(() -> TierValidator.validateAgainstExisting(tier(5, 15, "4.00"), existing))
        .isInstanceOf(ApiException.class)
        .satisfies(ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_OVERLAP));
  }

  @Test
  void nonOverlappingCandidateAccepted() {
    List<TierRange> existing = List.of(tier(1, 10, "5.00"));
    assertThatCode(() -> TierValidator.validateAgainstExisting(tier(11, 20, "4.50"), existing))
        .doesNotThrowAnyException();
  }

  @Test
  void invertedRangeRejected() {
    assertThatThrownBy(() -> TierValidator.validateFields(tier(20, 10, "5.00")))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_RANGE_ERROR));
  }

  @Test
  void quantityOutOfBoundsRejected() {
    assertThatThrownBy(() -> TierValidator.validateFields(tier(0, 10, "5.00")))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_QUANTITY_ERROR));
    assertThatThrownBy(() -> TierValidator.validateFields(tier(1, 1_000_000, "5.00")))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_QUANTITY_ERROR));
  }

  @Test
  void priceOutOfBoundsOrTooManyDecimalsRejected() {
    assertThatThrownBy(() -> TierValidator.validateFields(tier(1, 10, "0.00")))
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_PRICE_ERROR));
    assertThatThrownBy(() -> TierValidator.validateFields(tier(1, 10, "1000000.00")))
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_PRICE_ERROR));
    assertThatThrownBy(() -> TierValidator.validateFields(tier(1, 10, "5.123")))
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_PRICE_ERROR));
  }
}
