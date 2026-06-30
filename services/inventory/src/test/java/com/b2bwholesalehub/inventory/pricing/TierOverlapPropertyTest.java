package com.b2bwholesalehub.inventory.pricing;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import java.math.BigDecimal;
import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Feature: b2b-wholesale-hub, Property 3: Overlapping pricing tiers are rejected and leave existing
 * tiers unchanged — for any existing tier set and any candidate whose inclusive range overlaps at
 * least one existing tier, the submission is rejected with an overlap error and the stored set is
 * unchanged; a candidate with min_qty &gt; max_qty is rejected with a range error.
 *
 * <p>**Validates: Requirements 5.2, 5.3**
 */
class TierOverlapPropertyTest {

  @Property(tries = 200)
  void overlappingCandidateRejectedAndExistingUnchanged(
      @ForAll("validTiers") List<TierRange> existing, @ForAll("validTier") TierRange candidate) {

    List<TierRange> snapshot = List.copyOf(existing);
    boolean overlaps = existing.stream().anyMatch(candidate::overlaps);

    if (overlaps) {
      assertThatThrownBy(() -> TierValidator.validateAgainstExisting(candidate, existing))
          .isInstanceOf(ApiException.class)
          .satisfies(
              ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_OVERLAP));
    } else {
      assertThatCode(() -> TierValidator.validateAgainstExisting(candidate, existing))
          .doesNotThrowAnyException();
    }
    // Existing tiers are never mutated by validation (rejection leaves them unchanged).
    assertThat(existing).isEqualTo(snapshot);
  }

  @Property(tries = 100)
  void invertedRangeRejectedWithRangeError(
      @ForAll("validTiers") List<TierRange> existing,
      @ForAll("rangePair") int[] pair,
      @ForAll("validPrice") BigDecimal price) {

    int min = Math.max(pair[0], pair[1]) + 1; // strictly greater
    int max = Math.min(pair[0], pair[1]);
    TierRange inverted = new TierRange(min, max, price);

    assertThatThrownBy(() -> TierValidator.validateAgainstExisting(inverted, existing))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex -> assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.TIER_RANGE_ERROR));
  }

  @Provide
  Arbitrary<TierRange> validTier() {
    Arbitrary<Integer> min = Arbitraries.integers().between(1, 5000);
    Arbitrary<Integer> width = Arbitraries.integers().between(0, 200);
    return Combinators.combine(min, width, validPrice())
        .as((m, w, price) -> new TierRange(m, Math.min(m + w, TierValidator.MAX_QTY), price));
  }

  @Provide
  Arbitrary<List<TierRange>> validTiers() {
    return validTier().list().ofMaxSize(6);
  }

  @Provide
  Arbitrary<BigDecimal> validPrice() {
    return Arbitraries.longs().between(1L, 99_999_999L).map(cents -> BigDecimal.valueOf(cents, 2));
  }

  @Provide
  Arbitrary<int[]> rangePair() {
    Arbitrary<Integer> a = Arbitraries.integers().between(1, 5000);
    Arbitrary<Integer> b = Arbitraries.integers().between(1, 5000);
    return Combinators.combine(a, b).as((x, y) -> new int[] {x, y});
  }
}
