package com.b2bwholesalehub.inventory.order;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * The pure result of splitting a cart at checkout: one sub-order plan per distinct supplier under a
 * single parent total. (Req 10.1, 10.2, 10.5)
 *
 * @param retailerId the checking-out retailer (recorded on every sub-order, Req 10.5)
 * @param orderTotal the parent total = sum of sub-order totals, half-up to 2 decimals (Req 10.2)
 * @param subOrders one plan per distinct supplier, in first-seen order
 */
public record OrderPlan(UUID retailerId, BigDecimal orderTotal, List<SubOrderPlan> subOrders) {

  /**
   * One supplier's planned sub-order.
   *
   * @param supplierId the supplier
   * @param retailerId the retailer (Req 10.5)
   * @param total the sub-order total = sum of its line subtotals (Req 10.5)
   * @param lines only this supplier's lines (Req 10.1)
   */
  public record SubOrderPlan(
      UUID supplierId, UUID retailerId, BigDecimal total, List<CheckoutLine> lines) {}
}
