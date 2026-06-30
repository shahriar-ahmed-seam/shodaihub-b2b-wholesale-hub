package com.b2bwholesalehub.inventory.fulfillment;

import com.b2bwholesalehub.inventory.order.OrderStatus;

/**
 * Pure stock-restoration rule for cancellation. No database, no Spring — directly unit- and
 * property-testable.
 *
 * <p>Cancelling a sub-order restores its units to the sellable quantity (Property 23, Req 12.5):
 *
 * <ul>
 *   <li>A CONFIRMED sub-order has already permanently decremented persistent stock, so its units
 *       are added back to available stock.
 *   <li>A PENDING sub-order still holds active reservations, so its reservations are released —
 *       persistent stock is untouched and the reserved units return to sellable.
 * </ul>
 *
 * In both cases the sellable quantity {@code stock - reserved} rises by exactly the cancelled
 * quantity.
 */
public final class CancellationStock {

  private CancellationStock() {}

  /** The persistent available-stock value after cancellation (only CONFIRMED adds units back). */
  public static int restoredPersistentStock(OrderStatus status, int currentStock, int totalQty) {
    return status == OrderStatus.CONFIRMED ? currentStock + totalQty : currentStock;
  }

  /** Whether cancellation should release the still-active reservations (PENDING only). */
  public static boolean releasesReservations(OrderStatus status) {
    return status == OrderStatus.PENDING;
  }
}
