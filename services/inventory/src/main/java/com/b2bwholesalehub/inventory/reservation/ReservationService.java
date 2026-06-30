package com.b2bwholesalehub.inventory.reservation;

import java.util.UUID;

/**
 * Clean interface over the Redis-backed reservation/locking system (Deep-Dive 2).
 *
 * <p>All mutating operations are implemented as single atomic Lua scripts evaluated by Redis —
 * there is no check-then-act logic in Java — which preserves the global invariant at all times:
 *
 * <pre>sum(active reservations) + confirmed decrements &lt;= available_stock</pre>
 *
 * <p>Each operation has a time-injectable {@code *At} variant used for deterministic testing; the
 * default methods delegate using the system clock and the configured TTL / renewal cap.
 */
public interface ReservationService {

  /**
   * Mirrors the authoritative persistent stock into Redis so Lua scripts can evaluate sellable
   * quantity atomically (Req 6.4, 7.4).
   */
  void syncStockMirror(UUID productId, int stock);

  /** Creates a 15-minute reservation when {@code qty <= sellable}, else rejects (Req 7.1–7.3). */
  ReserveResult reserve(UUID productId, UUID retailerId, int qty);

  /** Time-injectable variant of {@link #reserve(UUID, UUID, int)}. */
  ReserveResult reserveAt(UUID productId, UUID retailerId, int qty, long nowMillis, long ttlMillis);

  /** Releases a reservation (cart-removal path), returning the units freed (Req 7.6). */
  long release(String reservationId);

  /** Time-injectable variant of {@link #release(String)}. */
  long releaseAt(String reservationId, long nowMillis);

  /**
   * Renews expiry to now + 15 minutes, capped at the configured number of renewals (Req 7.9, 7.10).
   */
  RenewResult renew(String reservationId);

  /** Time-injectable variant of {@link #renew(String)}. */
  RenewResult renewAt(String reservationId, long nowMillis, long ttlMillis);

  /**
   * Converts a reservation into a permanent decrement, keeping the Redis mirror consistent (Req
   * 6.5, 7.7). Fails when the reservation has expired and current sellable stock is insufficient
   * (Req 11.9).
   */
  ConvertResult convert(UUID productId, String reservationId, int qty);

  /** Time-injectable variant of {@link #convert(UUID, String, int)}. */
  ConvertResult convertAt(UUID productId, String reservationId, int qty, long nowMillis);

  /**
   * True when the reservation still exists and has not expired — used to verify every line's
   * reservation is still active before splitting a cart at checkout (Req 10.4).
   */
  boolean isActive(String reservationId);

  /** Time-injectable variant of {@link #isActive(String)}. */
  boolean isActiveAt(String reservationId, long nowMillis);

  /** Current sellable quantity = stock - active reservations (Req 6.4, 7.4). */
  long sellable(UUID productId);

  /** Time-injectable variant of {@link #sellable(UUID)}. */
  long sellableAt(UUID productId, long nowMillis);

  /** Reaps expired reservations for one product, returning the units reclaimed (Req 7.5). */
  long reapExpiredAt(UUID productId, long nowMillis);

  /**
   * Scans every product and reaps expired reservations, returning total units reclaimed (Req 7.5).
   */
  long reapAll();
}
