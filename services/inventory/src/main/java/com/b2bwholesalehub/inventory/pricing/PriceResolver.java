package com.b2bwholesalehub.inventory.pricing;

import com.b2bwholesalehub.inventory.common.Money;
import java.math.BigDecimal;
import java.util.List;

/**
 * Pure price-resolution logic. No database, no Spring — directly unit- and property-testable.
 *
 * <p>Because non-overlapping tiers are guaranteed by {@link TierValidator}, at most one tier
 * matches any quantity, so resolution is deterministic. (Design Deep-Dive 1)
 */
public final class PriceResolver {

  private PriceResolver() {}

  /**
   * Resolves the per-unit price for a quantity: the unit price of the unique tier whose inclusive
   * range contains {@code qty}, or the product base price when no tier contains it. (Req 5.6, 5.7)
   *
   * @param basePrice the product base price (used when no tier matches)
   * @param tiers the product's pricing tiers (assumed non-overlapping)
   * @param qty the requested quantity (must be a positive integer)
   * @return the resolved per-unit price
   */
  public static BigDecimal resolveUnitPrice(BigDecimal basePrice, List<TierRange> tiers, int qty) {
    if (qty < 1) {
      throw new IllegalArgumentException("quantity must be a positive integer");
    }
    for (TierRange tier : tiers) {
      if (tier.contains(qty)) {
        return tier.unitPrice();
      }
    }
    return basePrice;
  }

  /**
   * Computes the line subtotal as {@code resolvedUnitPrice * qty}, rounded half-up to 2 decimals.
   * (Req 5.8)
   */
  public static BigDecimal lineSubtotal(BigDecimal basePrice, List<TierRange> tiers, int qty) {
    return Money.lineSubtotal(resolveUnitPrice(basePrice, tiers, qty), qty);
  }
}
