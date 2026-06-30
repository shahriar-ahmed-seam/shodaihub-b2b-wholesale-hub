package com.b2bwholesalehub.inventory.order;

/**
 * Fulfillment state of a sub-order. The forward path is CONFIRMED → PACKED → SHIPPED → DELIVERED;
 * PENDING or CONFIRMED sub-orders may also move to CANCELLED. (Req 10.3, 12)
 */
public enum OrderStatus {
  PENDING,
  CONFIRMED,
  PACKED,
  SHIPPED,
  DELIVERED,
  CANCELLED
}
