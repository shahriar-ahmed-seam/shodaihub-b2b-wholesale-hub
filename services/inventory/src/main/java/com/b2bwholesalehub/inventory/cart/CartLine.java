package com.b2bwholesalehub.inventory.cart;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Immutable projection of a cart line used by the pure grouping/total algorithms, decoupled from
 * the JPA {@link CartItem} so the domain logic is unit- and property-testable without a database.
 *
 * @param id the cart-item id
 * @param productId the product
 * @param supplierId the owning supplier (the grouping key, Req 9.4)
 * @param quantity the selected quantity
 * @param unitPrice the resolved per-unit price in BDT
 * @param subtotal the line subtotal in BDT (unitPrice * quantity, half-up to 2 decimals)
 */
public record CartLine(
    UUID id,
    UUID productId,
    UUID supplierId,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal subtotal) {

  public static CartLine from(CartItem item) {
    return new CartLine(
        item.getId(),
        item.getProductId(),
        item.getSupplierId(),
        item.getQuantity(),
        item.getResolvedUnitPrice(),
        item.getSubtotal());
  }
}
