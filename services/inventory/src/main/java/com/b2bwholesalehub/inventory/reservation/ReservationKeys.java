package com.b2bwholesalehub.inventory.reservation;

import java.util.UUID;

/**
 * Redis key model for the reservation/locking system (Deep-Dive 2 → Reservation_Store data model).
 *
 * <p>Per product the store keeps:
 *
 * <ul>
 *   <li>{@code resv:{reservationId}} — Hash {@code {productId, retailerId, qty, renewals,
 *       expiresAt, member, ...keys}} with a TTL {@code PEXPIRE}.
 *   <li>{@code product:{id}:reservations} — Sorted Set of {@code "{reservationId}:{qty}"} members
 *       scored by expiry, used to sum active reservations and reconcile expiry.
 *   <li>{@code product:{id}:stock} — cached available-stock mirror (authoritative value lives in
 *       PostgreSQL; the mirror enables atomic Lua evaluation).
 *   <li>{@code product:{id}:reserved_total} — integer counter of currently reserved units.
 * </ul>
 *
 * <p>Sellable quantity = {@code stock - reserved_total} (Req 6.4).
 */
public final class ReservationKeys {

  public static final String RESERVATION_HASH_PREFIX = "resv:";
  private static final String PRODUCT_PREFIX = "product:";

  private ReservationKeys() {}

  /** {@code resv:{reservationId}} reservation hash key. */
  public static String reservationHash(String reservationId) {
    return RESERVATION_HASH_PREFIX + reservationId;
  }

  /** {@code product:{id}:stock} available-stock mirror key. */
  public static String stock(UUID productId) {
    return PRODUCT_PREFIX + productId + ":stock";
  }

  /** {@code product:{id}:reserved_total} reserved-units counter key. */
  public static String reservedTotal(UUID productId) {
    return PRODUCT_PREFIX + productId + ":reserved_total";
  }

  /** {@code product:{id}:reservations} expiry-scored reservation sorted-set key. */
  public static String reservationSet(UUID productId) {
    return PRODUCT_PREFIX + productId + ":reservations";
  }

  /**
   * Derives the {@code reserved_total} key from a {@code product:{id}:reservations} key. Used by
   * the reaper sweep which discovers products by scanning reservation-set keys.
   */
  public static String reservedTotalFromSetKey(String reservationSetKey) {
    String suffix = ":reservations";
    String base = reservationSetKey.substring(0, reservationSetKey.length() - suffix.length());
    return base + ":reserved_total";
  }
}
