package com.b2bwholesalehub.inventory.review;

/**
 * Pure review-eligibility rule. No database, no Spring — directly unit- and property-testable.
 *
 * <p>A retailer may submit a review for a product if and only if they have at least one DELIVERED
 * sub-order for that product and have not already reviewed it (one review per product). The rating
 * must be an integer from 1 to 5. (Property 29; Req 15.1, 15.2)
 */
public final class ReviewEligibility {

  public static final int MIN_RATING = 1;
  public static final int MAX_RATING = 5;

  private ReviewEligibility() {}

  /**
   * True iff the retailer has a delivered sub-order for the product and has not reviewed it yet.
   */
  public static boolean canReview(boolean hasDeliveredSubOrder, boolean alreadyReviewed) {
    return hasDeliveredSubOrder && !alreadyReviewed;
  }

  /** True iff the rating is an integer within the inclusive 1–5 range. */
  public static boolean isValidRating(int rating) {
    return rating >= MIN_RATING && rating <= MAX_RATING;
  }
}
