package com.b2bwholesalehub.inventory.fulfillment;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.order.OrderStatus;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 23: Cancellation restores stock — for any sub-order in
 * PENDING or CONFIRMED status, cancellation sets the status to CANCELLED and restores the
 * previously reserved or decremented quantity back to available stock; i.e. the sellable quantity
 * rises by exactly the cancelled quantity.
 *
 * <p>**Validates: Requirements 12.5**
 */
class CancellationStockPropertyTest {

  @Property(tries = 200)
  void cancellationRestoresSellableByCancelledQuantity(
      @ForAll("cancellable") OrderStatus status,
      @ForAll @IntRange(min = 0, max = 1_000_000) int stock,
      @ForAll @IntRange(min = 0, max = 1_000_000) int reserved,
      @ForAll @IntRange(min = 1, max = 100_000) int qty) {

    long sellableBefore = (long) stock - reserved;

    // Model the effect of cancellation on (persistent stock, reserved units).
    int newStock = CancellationStock.restoredPersistentStock(status, stock, qty);
    int newReserved = CancellationStock.releasesReservations(status) ? reserved - qty : reserved;

    long sellableAfter = (long) newStock - newReserved;

    // The cancelled units return to sellable, regardless of whether they were reserved (PENDING)
    // or already decremented (CONFIRMED).
    assertThat(sellableAfter).isEqualTo(sellableBefore + qty);

    if (status == OrderStatus.CONFIRMED) {
      // Decremented units are added back to persistent stock.
      assertThat(newStock).isEqualTo(stock + qty);
      assertThat(CancellationStock.releasesReservations(status)).isFalse();
    } else {
      // PENDING reservations are released; persistent stock is untouched.
      assertThat(newStock).isEqualTo(stock);
      assertThat(CancellationStock.releasesReservations(status)).isTrue();
    }
  }

  @net.jqwik.api.Provide
  net.jqwik.api.Arbitrary<OrderStatus> cancellable() {
    return net.jqwik.api.Arbitraries.of(OrderStatus.PENDING, OrderStatus.CONFIRMED);
  }
}
