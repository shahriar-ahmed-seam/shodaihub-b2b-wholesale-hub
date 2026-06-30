package com.b2bwholesalehub.inventory.review;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.List;

/**
 * Pure average-rating computation. No database, no Spring — directly unit- and property-testable.
 *
 * <p>The stored average rating equals the arithmetic mean of the ratings of the currently visible
 * (non-hidden) reviews, rounded half-up to 2 decimals; with no visible reviews the average is
 * {@code null} (no rating). Hidden/removed reviews are excluded (Property 30). (Req 15.3, 15.4)
 */
public final class RatingCalculator {

  private RatingCalculator() {}

  /**
   * Arithmetic mean of the visible ratings to 2 decimals, or {@code null} when the list is empty.
   */
  public static BigDecimal average(List<Integer> visibleRatings) {
    if (visibleRatings.isEmpty()) {
      return null;
    }
    long sum = 0L;
    for (int rating : visibleRatings) {
      sum += rating;
    }
    return BigDecimal.valueOf(sum)
        .divide(BigDecimal.valueOf(visibleRatings.size()), Money.SCALE, Money.ROUNDING);
  }
}
