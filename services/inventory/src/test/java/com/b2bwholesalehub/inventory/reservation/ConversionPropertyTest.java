package com.b2bwholesalehub.inventory.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import net.jqwik.api.Assume;
import net.jqwik.api.Example;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.Size;

/**
 * Feature: b2b-wholesale-hub, Property 6: Reservation conversion conserves units — converting an
 * active reservation into a permanent stock decrement neither creates nor destroys units: the stock
 * mirror plus the total converted quantity stays equal to the initial stock, and the sellable
 * quantity is unchanged by the conversion.
 *
 * <p>**Validates: Requirements 6.5, 7.7**
 *
 * <p>Runs against a real {@code redis:7} container; aborts gracefully when Docker is unavailable.
 */
class ConversionPropertyTest {

  private static final long TTL = 900_000L;
  private static final long NOW = 1_000_000_000L;

  private record Active(String id, int qty) {}

  @Property(tries = 200)
  void conversionConservesUnits(
      @ForAll @IntRange(min = 1, max = 200) int stock,
      @ForAll @Size(max = 12) List<@IntRange(min = 1, max = 40) Integer> quantities) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, stock);

    // Reserve everything that fits, recording the active holds.
    List<Active> active = new ArrayList<>();
    for (int qty : quantities) {
      ReserveResult result = service.reserveAt(productId, retailerId, qty, NOW, TTL);
      if (result.granted()) {
        active.add(new Active(result.reservationId(), qty));
      }
    }

    long sellableBefore = service.sellableAt(productId, NOW);
    long converted = 0L;

    for (Active hold : active) {
      ConvertResult result = service.convertAt(productId, hold.id(), hold.qty(), NOW);
      assertThat(result.converted()).isTrue();
      converted += hold.qty();

      long mirror = RedisTestSupport.readLong(ReservationKeys.stock(productId));
      long reserved = RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId));

      // Units conserved: stock mirror + total permanently decremented == initial stock.
      assertThat(mirror + converted).isEqualTo((long) stock);
      // Conversion of an active hold leaves sellable unchanged (a reserved unit becomes a
      // decrement).
      assertThat(mirror - reserved).isEqualTo(sellableBefore);
      // Global invariant: reserved units never exceed remaining stock.
      assertThat(reserved).isLessThanOrEqualTo(mirror);
    }
  }

  /**
   * When a reservation has expired and current sellable stock is insufficient, conversion fails and
   * leaves Redis state untouched, so the sub-order can be flagged for reconciliation (Req 11.9).
   */
  @Example
  void expiredReservationWithInsufficientSellableFailsWithoutSideEffects() {
    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(100L, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, 5);

    long now = 1_000_000_000L;
    ReserveResult reserved = service.reserveAt(productId, retailerId, 5, now, 100L);
    assertThat(reserved.granted()).isTrue();

    // Reservation expires and is reaped, restoring the reserved units.
    long reclaimed = service.reapExpiredAt(productId, now + 1_000L);
    assertThat(reclaimed).isEqualTo(5L);

    // Stock has since dropped (e.g. external decrement), leaving sellable below the order quantity.
    service.syncStockMirror(productId, 3);

    ConvertResult result = service.convertAt(productId, reserved.reservationId(), 5, now + 2_000L);

    assertThat(result.converted()).isFalse();
    assertThat(result.value()).isEqualTo(3L); // current sellable returned
    assertThat(RedisTestSupport.readLong(ReservationKeys.stock(productId))).isEqualTo(3L);
    assertThat(RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId))).isEqualTo(0L);
  }
}
