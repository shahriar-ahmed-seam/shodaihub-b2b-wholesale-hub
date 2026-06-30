package com.b2bwholesalehub.inventory.reservation;

/**
 * Outcome of a reserve attempt (Req 7.1, 7.2).
 *
 * @param granted whether a reservation was created
 * @param reservationId the new reservation id when granted; {@code null} when rejected
 * @param sellable when granted, the remaining sellable quantity after the grant; when rejected, the
 *     current sellable quantity returned to the caller (Req 7.2)
 */
public record ReserveResult(boolean granted, String reservationId, long sellable) {

  public static ReserveResult granted(String reservationId, long remainingSellable) {
    return new ReserveResult(true, reservationId, remainingSellable);
  }

  public static ReserveResult rejected(long currentSellable) {
    return new ReserveResult(false, null, currentSellable);
  }
}
