package com.b2bwholesalehub.inventory.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read model for a retailer viewing an order: sub-orders grouped by supplier, each showing its
 * status, the tracking reference when shipped, and the timestamp of its most recent status change.
 * (Req 13.1, 13.2, 13.3)
 */
public record OrderView(
    UUID orderId, BigDecimal orderTotal, Instant createdAt, List<SupplierGroup> suppliers) {

  /** All of one supplier's sub-orders within this order. */
  public record SupplierGroup(UUID supplierId, List<SubOrderView> subOrders) {}

  /**
   * One sub-order's tracking view.
   *
   * @param subOrderId the sub-order id
   * @param status its current fulfillment status
   * @param trackingReference the tracking reference, present only when SHIPPED (Req 13.2)
   * @param mostRecentStatusChange the latest status-change timestamp (Req 13.3)
   * @param lines the ordered lines
   */
  public record SubOrderView(
      UUID subOrderId,
      OrderStatus status,
      String trackingReference,
      Instant mostRecentStatusChange,
      List<LineView> lines) {}

  /** A single ordered line. */
  public record LineView(
      UUID productId, int quantity, BigDecimal unitPrice, BigDecimal lineSubtotal) {}
}
