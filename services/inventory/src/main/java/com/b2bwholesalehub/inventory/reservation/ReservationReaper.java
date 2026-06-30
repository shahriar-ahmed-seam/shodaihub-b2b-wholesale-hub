package com.b2bwholesalehub.inventory.reservation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Active expiry reaper (Deep-Dive 2 → TTL-based expiry; Req 7.5).
 *
 * <p>Runs on a fixed ~2-second delay, scanning every product's reservation set for entries whose
 * expiry score is in the past, removing them and decrementing {@code reserved_total} so the
 * released quantity is restored to sellable within the required 5-second window. Lazy
 * reconciliation inside the reserve/release/convert scripts and the keyspace-notification trigger
 * ({@link ReservationExpiryListener}) are complementary mechanisms. Failures (e.g. transient Redis
 * unavailability) are logged and never propagated, so a scan blip cannot crash the scheduler.
 */
@Component
public class ReservationReaper {

  private static final Logger log = LoggerFactory.getLogger(ReservationReaper.class);

  private final ReservationService reservationService;

  public ReservationReaper(ReservationService reservationService) {
    this.reservationService = reservationService;
  }

  @Scheduled(fixedDelayString = "${reservation.reaper.fixed-delay-millis:2000}")
  public void sweep() {
    try {
      long reclaimed = reservationService.reapAll();
      if (reclaimed > 0 && log.isDebugEnabled()) {
        log.debug("Reservation reaper reclaimed {} units", reclaimed);
      }
    } catch (RuntimeException ex) {
      log.warn("Reservation reaper sweep failed: {}", ex.getMessage());
    }
  }
}
