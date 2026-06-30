package com.b2bwholesalehub.inventory.cart;

import com.b2bwholesalehub.inventory.common.Money;
import com.b2bwholesalehub.inventory.pricing.PriceResolver;
import com.b2bwholesalehub.inventory.pricing.TierRange;
import java.math.BigDecimal;
import java.util.List;

/**
 * Pure cart-line resolution and MOQ enforcement. No database, no Spring — directly unit- and
 * property-testable.
 *
 * <p>A cart add (or quantity change) is permitted iff the requested quantity is at least the
 * product MOQ (Property 11). When permitted, the per-unit price is resolved against the applicable
 * tier and the subtotal is the price times quantity rounded half-up — and re-resolving for a new
 * quantity stays consistent (Property 13). (Req 9.1, 9.2, 9.3)
 */
public final class CartLineMath {

  private CartLineMath() {}

  /** A resolved cart line: the per-unit price and the subtotal in BDT. */
  public record Resolved(BigDecimal unitPrice, BigDecimal subtotal) {}

  /** True iff the requested quantity meets the product minimum order quantity. (Req 9.1, 9.2) */
  public static boolean meetsMoq(int quantity, int moq) {
    return quantity >= moq;
  }

  /**
   * Resolves the per-unit price for the quantity and computes the subtotal. (Req 9.1, 9.3, 5.6–5.8)
   */
  public static Resolved resolve(BigDecimal basePrice, List<TierRange> tiers, int quantity) {
    BigDecimal unitPrice = PriceResolver.resolveUnitPrice(basePrice, tiers, quantity);
    return new Resolved(unitPrice, Money.lineSubtotal(unitPrice, quantity));
  }
}
