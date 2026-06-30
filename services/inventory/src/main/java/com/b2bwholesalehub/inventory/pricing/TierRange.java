package com.b2bwholesalehub.inventory.pricing;

import java.math.BigDecimal;

/**
 * Immutable value object for a pricing tier used by the pure pricing algorithms (overlap detection
 * and price resolution). It is intentionally decoupled from the JPA {@code PricingTierEntity} so
 * the domain logic can be unit- and property-tested without a database.
 *
 * <p>The quantity range {@code [minQty, maxQty]} is inclusive of both bounds. (Req 5.1)
 *
 * @param minQty inclusive lower quantity bound
 * @param maxQty inclusive upper quantity bound
 * @param unitPrice per-unit price in BDT for quantities within the range
 */
public record TierRange(int minQty, int maxQty, BigDecimal unitPrice) {

  /**
   * Two inclusive ranges overlap iff {@code a.min <= b.max AND b.min <= a.max}. (Req 5.2)
   *
   * @param other the range to compare against
   * @return true when this range shares at least one quantity with {@code other}
   */
  public boolean overlaps(TierRange other) {
    return this.minQty <= other.maxQty && other.minQty <= this.maxQty;
  }

  /** True when the given quantity falls within this inclusive range. (Req 5.6) */
  public boolean contains(int qty) {
    return qty >= minQty && qty <= maxQty;
  }
}
