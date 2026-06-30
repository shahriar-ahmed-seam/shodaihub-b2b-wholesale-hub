package com.b2bwholesalehub.inventory.order;

import java.util.List;
import java.util.function.Predicate;

/**
 * Pure checkout gate. No database, no Spring — directly unit- and property-testable.
 *
 * <p>Given the cart's lines and a liveness check for each line's reservation, it either halts
 * (identifying every line whose reservation is no longer active) or produces the split order plan.
 * On halt nothing is planned, so no parent order or sub-orders are created and the cart is left
 * untouched. (Property 17; Req 10.4)
 */
public final class CheckoutPlanner {

  private CheckoutPlanner() {}

  /**
   * The outcome of planning a checkout.
   *
   * @param halted true when at least one reservation was inactive
   * @param affected the lines whose reservations were inactive (empty when not halted)
   * @param plan the split order plan (null when halted)
   */
  public record Outcome(boolean halted, List<CheckoutLine> affected, OrderPlan plan) {

    public static Outcome halted(List<CheckoutLine> affected) {
      return new Outcome(true, List.copyOf(affected), null);
    }

    public static Outcome planned(OrderPlan plan) {
      return new Outcome(false, List.of(), plan);
    }
  }

  /**
   * Plans a checkout for {@code retailerId}. The {@code reservationActive} predicate returns true
   * when a line's reservation is still active.
   */
  public static Outcome plan(
      java.util.UUID retailerId,
      List<CheckoutLine> lines,
      Predicate<CheckoutLine> reservationActive) {
    List<CheckoutLine> affected =
        lines.stream().filter(line -> !reservationActive.test(line)).toList();
    if (!affected.isEmpty()) {
      return Outcome.halted(affected);
    }
    return Outcome.planned(OrderSplitter.split(retailerId, lines));
  }
}
