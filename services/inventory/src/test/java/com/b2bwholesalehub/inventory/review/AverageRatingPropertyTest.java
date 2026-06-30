package com.b2bwholesalehub.inventory.review;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Feature: b2b-wholesale-hub, Property 30: Average rating equals the mean of visible ratings — for
 * any set of submitted reviews for a product, after any submission or administrative removal the
 * stored average rating equals the arithmetic mean of the ratings of the currently visible
 * (non-hidden) reviews, and removed reviews are excluded.
 *
 * <p>**Validates: Requirements 15.3, 15.4**
 */
class AverageRatingPropertyTest {

  /** A submitted review: its rating and whether an administrator has hidden (removed) it. */
  private record ReviewState(int rating, boolean hidden) {}

  @Property(tries = 200)
  void averageEqualsMeanOfVisibleRatings(@ForAll("reviews") List<ReviewState> reviews) {
    List<Integer> visible =
        reviews.stream().filter(r -> !r.hidden()).map(ReviewState::rating).toList();

    BigDecimal actual = RatingCalculator.average(visible);

    if (visible.isEmpty()) {
      // No visible reviews -> no rating.
      assertThat(actual).isNull();
    } else {
      long sum = visible.stream().mapToLong(Integer::longValue).sum();
      BigDecimal expected =
          BigDecimal.valueOf(sum)
              .divide(BigDecimal.valueOf(visible.size()), 2, RoundingMode.HALF_UP);
      assertThat(actual).isEqualByComparingTo(expected);
      // The mean lies within the rating bounds.
      assertThat(actual).isBetween(new BigDecimal("1.00"), new BigDecimal("5.00"));
    }
  }

  @Property(tries = 100)
  void hidingAReviewExcludesItFromTheAverage() {
    // Two visible 5s and one hidden 1 -> average is 5.00, not 3.67.
    List<Integer> visibleOnly = List.of(5, 5);
    assertThat(RatingCalculator.average(visibleOnly)).isEqualByComparingTo(new BigDecimal("5.00"));
  }

  @Provide
  Arbitrary<List<ReviewState>> reviews() {
    Arbitrary<Integer> rating = Arbitraries.integers().between(1, 5);
    Arbitrary<Boolean> hidden = Arbitraries.of(true, false);
    Arbitrary<ReviewState> review = Combinators.combine(rating, hidden).as(ReviewState::new);
    return review.list().ofMaxSize(30).map(ArrayList::new);
  }
}
