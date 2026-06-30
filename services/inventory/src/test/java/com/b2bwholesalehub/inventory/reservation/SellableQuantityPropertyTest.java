package com.b2bwholesalehub.inventory.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import net.jqwik.api.Assume;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.Size;

/**
 * Feature: b2b-wholesale-hub, Property 4: Sellable quantity equals stock minus active reservations
 * — for any initial stock and any sequence of reservation requests, the sellable quantity reported
 * by the store always equals the available stock minus the sum of the quantities of the
 * reservations that were actually granted (and remain active).
 *
 * <p>**Validates: Requirements 6.4, 7.4**
 *
 * <p>Runs against a real {@code redis:7} container so the actual Lua scripts and {@code
 * reserved_total} accounting are exercised; aborts gracefully when Docker is unavailable.
 */
class SellableQuantityPropertyTest {

  private static final long TTL = 900_000L; // 15 min; no expiry within a single property try
  private static final long NOW = 1_000_000_000L;

  @Property(tries = 200)
  void sellableEqualsStockMinusActiveReservations(
      @ForAll @IntRange(min = 0, max = 200) int stock,
      @ForAll @Size(max = 10) List<@IntRange(min = 1, max = 60) Integer> quantities) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, stock);

    long expectedReserved = 0L;
    for (int qty : quantities) {
      long sellableBefore = service.sellableAt(productId, NOW);
      ReserveResult result = service.reserveAt(productId, retailerId, qty, NOW, TTL);

      // A reservation is granted iff the request fits within the current sellable quantity (Req
      // 7.1, 7.2).
      if (qty <= sellableBefore) {
        assertThat(result.granted()).isTrue();
        expectedReserved += qty;
      } else {
        assertThat(result.granted()).isFalse();
        assertThat(result.sellable()).isEqualTo(sellableBefore);
      }

      // Invariant after every step: sellable == stock - sum(active reservations).
      assertThat(service.sellableAt(productId, NOW)).isEqualTo(stock - expectedReserved);
      assertThat(RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId)))
          .isEqualTo(expectedReserved);
    }

    assertThat(service.sellableAt(productId, NOW)).isEqualTo(stock - expectedReserved);
  }
}
