package com.b2bwholesalehub.inventory.fulfillment;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.order.OrderStatus;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;

/**
 * Pure fulfillment state machine. No database, no Spring — directly unit- and property-testable.
 *
 * <p>The forward fulfillment path is CONFIRMED → PACKED → SHIPPED → DELIVERED; a sub-order in
 * PENDING or CONFIRMED may also transition to CANCELLED. Any other transition is invalid and is
 * rejected, leaving the status unchanged (Property 22). (Req 12.1–12.5)
 */
public final class FulfillmentStateMachine {

  private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED =
      Map.of(
          OrderStatus.PENDING, Set.of(OrderStatus.CANCELLED),
          OrderStatus.CONFIRMED, Set.of(OrderStatus.PACKED, OrderStatus.CANCELLED),
          OrderStatus.PACKED, Set.of(OrderStatus.SHIPPED),
          OrderStatus.SHIPPED, Set.of(OrderStatus.DELIVERED),
          OrderStatus.DELIVERED, Set.of(),
          OrderStatus.CANCELLED, Set.of());

  private FulfillmentStateMachine() {}

  /** True iff {@code (from → to)} is an edge of the allowed transition graph. */
  public static boolean isAllowed(OrderStatus from, OrderStatus to) {
    return ALLOWED.getOrDefault(from, Set.of()).contains(to);
  }

  /**
   * Validates a transition, throwing an invalid-transition error (leaving the status unchanged)
   * when it is not an allowed edge. (Req 12.4)
   */
  public static void validate(OrderStatus from, OrderStatus to) {
    if (!isAllowed(from, to)) {
      throw new ApiException(
          ErrorCode.INVALID_TRANSITION,
          HttpStatus.CONFLICT,
          "Invalid status transition from " + from + " to " + to + ".");
    }
  }
}
