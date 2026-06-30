package com.b2bwholesalehub.inventory.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.connection.Message;
import org.springframework.data.redis.connection.MessageListener;

/**
 * Secondary, best-effort expiry trigger driven by Redis keyspace notifications (Deep-Dive 2 → "a
 * secondary trigger"). When a reservation hash key expires, Redis emits a {@code
 * __keyevent@*__:expired} event; the hash itself is already gone, so the listener simply kicks a
 * reaper sweep that reconciles the orphaned sorted-set entry and {@code reserved_total} counter.
 * The scheduled {@link ReservationReaper} remains the primary mechanism that guarantees the
 * 5-second restoration window.
 */
public class ReservationExpiryListener implements MessageListener {

  private static final Logger log = LoggerFactory.getLogger(ReservationExpiryListener.class);

  private final ReservationService reservationService;

  public ReservationExpiryListener(ReservationService reservationService) {
    this.reservationService = reservationService;
  }

  @Override
  public void onMessage(Message message, byte[] pattern) {
    String expiredKey = new String(message.getBody());
    if (!expiredKey.startsWith(ReservationKeys.RESERVATION_HASH_PREFIX)) {
      return; // only reservation-hash expiries are relevant
    }
    try {
      reservationService.reapAll();
    } catch (RuntimeException ex) {
      log.warn("Keyspace-notification reap failed for {}: {}", expiredKey, ex.getMessage());
    }
  }
}
