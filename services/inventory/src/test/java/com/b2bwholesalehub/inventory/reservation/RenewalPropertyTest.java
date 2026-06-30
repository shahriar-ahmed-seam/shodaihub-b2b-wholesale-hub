package com.b2bwholesalehub.inventory.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.UUID;
import net.jqwik.api.Assume;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 7: Reservation renewal resets expiry and is capped at three
 * renewals — each renewal before the cap sets the expiry to now + 15 minutes and increments the
 * renewal count; once three renewals have occurred, further renewals are rejected and the existing
 * expiry is retained.
 *
 * <p>**Validates: Requirements 7.9, 7.10**
 *
 * <p>Runs against a real {@code redis:7} container; aborts gracefully when Docker is unavailable.
 */
class RenewalPropertyTest {

  private static final long TTL = 900_000L;
  private static final int CAP = 3;

  @Property(tries = 200)
  void renewalResetsExpiryAndCapsAtThree(
      @ForAll @IntRange(min = 1, max = 7) int attempts,
      @ForAll @IntRange(min = 1, max = 5000) int step) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, CAP);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, 1_000);

    long now = 1_000_000_000L;
    ReserveResult reserved = service.reserveAt(productId, retailerId, 1, now, TTL);
    assertThat(reserved.granted()).isTrue();
    String reservationId = reserved.reservationId();

    int expectedRenewals = 0;
    long retainedExpiry = now + TTL;

    for (int i = 0; i < attempts; i++) {
      now += step; // advance the clock but stay well within the active window
      RenewResult result = service.renewAt(reservationId, now, TTL);

      if (expectedRenewals < CAP) {
        // Below the cap: renew succeeds, count increments, expiry resets to now + TTL (Req 7.9).
        assertThat(result.renewed()).isTrue();
        assertThat(result.renewals()).isEqualTo(expectedRenewals + 1);
        assertThat(result.expiresAt()).isEqualTo(now + TTL);
        assertThat(result.expiresAt()).isGreaterThan(retainedExpiry);
        expectedRenewals++;
        retainedExpiry = now + TTL;
      } else {
        // At the cap: renew is rejected and the existing expiry is retained (Req 7.10).
        assertThat(result.renewed()).isFalse();
        assertThat(result.renewals()).isEqualTo(CAP);
        assertThat(result.expiresAt()).isEqualTo(retainedExpiry);
      }
    }
  }
}
