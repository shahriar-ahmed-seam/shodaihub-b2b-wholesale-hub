package com.b2bwholesalehub.inventory.order;

import java.util.List;
import java.util.UUID;

/**
 * The successful checkout response: the parent order id and, for each sub-order, its id and status.
 * (Req 10.7)
 */
public record CheckoutResponse(UUID orderId, List<SubOrderStatus> subOrders) {

  /** A sub-order's id and current fulfillment status. */
  public record SubOrderStatus(UUID subOrderId, UUID supplierId, OrderStatus status) {}
}
