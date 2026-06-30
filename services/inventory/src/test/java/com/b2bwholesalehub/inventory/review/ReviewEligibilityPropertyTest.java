package com.b2bwholesalehub.inventory.review;

import static org.assertj.core.api.Assertions.assertThat;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 29: Review eligibility requires a delivered sub-order and is
 * unique per product — for any retailer and product, submitting a rating (1–5) with optional review
 * succeeds at most once and only if the retailer has at least one DELIVERED sub-order for that
 * product; otherwise the submission is rejected with an eligibility error.
 *
 * <p>**Validates: Requirements 15.1, 15.2**
 */
class ReviewEligibilityPropertyTest {

  @Property(tries = 200)
  void eligibleIffDeliveredAndNotAlreadyReviewed(
      @ForAll boolean hasDelivered, @ForAll boolean alreadyReviewed) {
    boolean canReview = ReviewEligibility.canReview(hasDelivered, alreadyReviewed);
    // Permitted exactly when there is a delivered sub-order and no prior review (unique per
    // product).
    assertThat(canReview).isEqualTo(hasDelivered && !alreadyReviewed);
  }

  @Property(tries = 200)
  void ratingValidIffWithinOneToFive(@ForAll @IntRange(min = -20, max = 20) int rating) {
    boolean valid = ReviewEligibility.isValidRating(rating);
    assertThat(valid).isEqualTo(rating >= 1 && rating <= 5);
  }
}
