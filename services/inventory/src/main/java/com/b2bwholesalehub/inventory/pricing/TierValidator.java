package com.b2bwholesalehub.inventory.pricing;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Pure validation logic for pricing tiers — field validation plus inclusive-range overlap
 * detection. No database access, so it is fully property-testable. The transactional {@code FOR
 * UPDATE} wrapping that makes overlap rejection concurrency-safe lives in the service layer; this
 * class supplies the decision the transaction enforces. (Design Deep-Dive 1)
 */
public final class TierValidator {

  public static final int MIN_QTY = 1;
  public static final int MAX_QTY = 999999;

  private TierValidator() {}

  /**
   * Validates a candidate tier's own fields. (Req 5.3, 5.4, 5.5)
   *
   * @throws ApiException with a tier-specific error code when any field is invalid
   */
  public static void validateFields(TierRange candidate) {
    int min = candidate.minQty();
    int max = candidate.maxQty();
    BigDecimal price = candidate.unitPrice();

    if (min < MIN_QTY || min > MAX_QTY || max < MIN_QTY || max > MAX_QTY) {
      throw new ApiException(
          ErrorCode.TIER_QUANTITY_ERROR,
          HttpStatus.BAD_REQUEST,
          "Tier quantities must be integers within [1, 999999].",
          List.of(new FieldIssue("minQty/maxQty", "must be an integer in [1, 999999]")));
    }
    if (min > max) {
      throw new ApiException(
          ErrorCode.TIER_RANGE_ERROR,
          HttpStatus.BAD_REQUEST,
          "Tier minimum quantity must not exceed its maximum quantity.",
          List.of(new FieldIssue("minQty", "must be <= maxQty")));
    }
    if (price == null
        || price.compareTo(Money.MIN_TIER_PRICE) < 0
        || price.compareTo(Money.MAX_TIER_PRICE) > 0
        || !Money.hasAtMostTwoDecimals(price)) {
      throw new ApiException(
          ErrorCode.TIER_PRICE_ERROR,
          HttpStatus.BAD_REQUEST,
          "Tier per-unit price must be within [0.01, 999999.99] with at most 2 decimals.",
          List.of(new FieldIssue("unitPrice", "must be in [0.01, 999999.99] with <= 2 decimals")));
    }
  }

  /**
   * Returns the first existing tier that overlaps the candidate, or {@code null} when none overlap.
   * (Req 5.2)
   */
  public static TierRange findOverlap(TierRange candidate, List<TierRange> existing) {
    for (TierRange tier : existing) {
      if (candidate.overlaps(tier)) {
        return tier;
      }
    }
    return null;
  }

  /**
   * Validates a candidate against its own fields and all existing tiers. Throws on the first
   * problem, leaving the caller's existing tier set untouched. (Req 5.2, 5.3, 5.4, 5.5)
   */
  public static void validateAgainstExisting(TierRange candidate, List<TierRange> existing) {
    validateFields(candidate);
    TierRange overlap = findOverlap(candidate, existing);
    if (overlap != null) {
      throw new ApiException(
          ErrorCode.TIER_OVERLAP,
          HttpStatus.CONFLICT,
          "The pricing tier overlaps an existing tier.",
          List.of(
              new FieldIssue(
                  "minQty", "overlaps tier [" + overlap.minQty() + "," + overlap.maxQty() + "]")));
    }
  }
}
