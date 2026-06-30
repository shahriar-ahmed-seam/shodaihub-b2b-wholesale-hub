package com.b2bwholesalehub.inventory.order;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Immutable snapshot of a cart line as it enters checkout, decoupled from JPA so the splitting and
 * halting logic is unit- and property-testable without a database.
 *
 * @param cartItemId the originating cart-item id (used to identify affected items on halt, Req
 *     10.4)
 * @param productId the product
 * @param supplierId the owning supplier (the split key, Req 10.1)
 * @param quantity the ordered quantity
 * @param unitPrice the resolved per-unit price in BDT
 * @param lineSubtotal the line subtotal in BDT
 * @param reservationId the Redis reservation backing this line
 */
public record CheckoutLine(
    UUID cartItemId,
    UUID productId,
    UUID supplierId,
    int quantity,
    BigDecimal unitPrice,
    BigDecimal lineSubtotal,
    String reservationId) {}
