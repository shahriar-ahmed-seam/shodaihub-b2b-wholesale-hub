package com.b2bwholesalehub.inventory.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicLong;
import net.jqwik.api.Assume;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 5: Reservations never oversell stock (global concurrency
 * invariant) — verified under <em>real</em> thread contention against a live Redis, not a simulated
 * interleaving.
 *
 * <p>Many threads are released simultaneously (via a {@link CyclicBarrier}) to hammer the same
 * product's reservation state through the atomic Lua scripts. Because every mutation is a single
 * {@code EVAL}, Redis serializes the check-then-act, so the sum of granted reservations can never
 * exceed the sellable stock — proving the design invariant
 *
 * <pre>sum(active reservations) + confirmed decrements &lt;= available_stock</pre>
 *
 * holds even when reserve / release / convert race against each other.
 *
 * <p>**Validates: Requirements 7.1, 7.2, 7.8, 18.4**
 *
 * <p>Runs against a real {@code redis:7} container; aborts gracefully when Docker is unavailable.
 */
class ConcurrentOversellInvariantPropertyTest {

  private static final long TTL = 900_000L; // 15 min; no expiry during a try

  /**
   * The "last unit" race: many threads each try to reserve a fixed quantity of the same product at
   * the same instant. Exactly the number of non-overlapping quantity-sized holds that fit in stock
   * may be granted — never one unit more.
   */
  @Property(tries = 120)
  void concurrentReservesNeverOversell(
      @ForAll @IntRange(min = 1, max = 25) int stock,
      @ForAll @IntRange(min = 2, max = 48) int threadCount,
      @ForAll @IntRange(min = 1, max = 4) int qtyPerThread) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, stock);

    ConcurrentLinkedQueue<String> grantedIds = new ConcurrentLinkedQueue<>();
    AtomicLong grantedUnits = new AtomicLong();
    CyclicBarrier barrier = new CyclicBarrier(threadCount);
    ExecutorService pool = Executors.newFixedThreadPool(threadCount);

    try {
      List<Future<?>> futures = new java.util.ArrayList<>();
      for (int i = 0; i < threadCount; i++) {
        futures.add(
            pool.submit(
                () -> {
                  barrier.await(); // release all threads at once for maximum contention
                  ReserveResult r = service.reserve(productId, retailerId, qtyPerThread);
                  if (r.granted()) {
                    grantedIds.add(r.reservationId());
                    grantedUnits.addAndGet(qtyPerThread);
                  }
                  return null;
                }));
      }
      awaitAll(futures);
    } finally {
      shutdown(pool);
    }

    long reserved = RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId));
    long granted = grantedUnits.get();

    // reserved_total exactly matches the units the service reported as granted (no lost/double
    // accounting under contention).
    assertThat(reserved).isEqualTo(granted);
    assertThat(reserved).isEqualTo((long) grantedIds.size() * qtyPerThread);
    // THE invariant: granted units never exceed stock => never oversell (Req 7.8, 18.4).
    assertThat(granted).isLessThanOrEqualTo((long) stock);
    // Atomic sellable read agrees with the counters.
    assertThat(service.sellable(productId)).isEqualTo(stock - reserved);
    assertThat(service.sellable(productId)).isGreaterThanOrEqualTo(0L);
    // No additional whole reservation could have fit: either every thread was granted, or the
    // leftover sellable was too small for one more qty-sized hold. This proves we granted exactly
    // as many as the stock allows — not fewer due to lost updates, not more due to races.
    long leftover = stock - granted;
    assertThat(grantedIds.size() == threadCount || leftover < qtyPerThread).isTrue();
  }

  /**
   * Reserve / release / convert racing together. Each worker reserves, then concurrently either
   * releases (cart removal) or converts (payment) its own hold. Afterwards the conservation and
   * non-oversell invariants must still hold exactly.
   */
  @Property(tries = 100)
  void concurrentReserveReleaseConvertConservesUnits(
      @ForAll @IntRange(min = 1, max = 30) int stock,
      @ForAll @IntRange(min = 2, max = 40) int threadCount) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, stock);

    AtomicLong convertedUnits = new AtomicLong();
    CyclicBarrier barrier = new CyclicBarrier(threadCount);
    ExecutorService pool = Executors.newFixedThreadPool(threadCount);

    try {
      List<Future<?>> futures = new java.util.ArrayList<>();
      for (int i = 0; i < threadCount; i++) {
        final int action = i % 3; // 0 = hold, 1 = release, 2 = convert
        futures.add(
            pool.submit(
                (Callable<Void>)
                    () -> {
                      int qty = ThreadLocalRandom.current().nextInt(1, 4);
                      barrier.await();
                      ReserveResult r = service.reserve(productId, retailerId, qty);
                      if (!r.granted()) {
                        return null;
                      }
                      switch (action) {
                        case 1 -> service.release(r.reservationId());
                        case 2 -> {
                          ConvertResult c = service.convert(productId, r.reservationId(), qty);
                          if (c.converted()) {
                            convertedUnits.addAndGet(qty);
                          }
                        }
                        default -> {
                          /* keep the reservation active */
                        }
                      }
                      return null;
                    }));
      }
      awaitAll(futures);
    } finally {
      shutdown(pool);
    }

    long mirror = RedisTestSupport.readLong(ReservationKeys.stock(productId));
    long reserved = RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId));
    long converted = convertedUnits.get();

    // Units are conserved: remaining stock mirror + permanently converted == initial stock.
    assertThat(mirror + converted).isEqualTo((long) stock);
    // Never oversell: active reservations never exceed the remaining stock.
    assertThat(reserved).isGreaterThanOrEqualTo(0L);
    assertThat(reserved).isLessThanOrEqualTo(mirror);
    // sum(active) + confirmed decrements <= initial available stock (Req 7.8, 18.4).
    assertThat(reserved + converted).isLessThanOrEqualTo((long) stock);
    // Sellable snapshot agrees and is never negative.
    assertThat(service.sellable(productId)).isEqualTo(mirror - reserved);
    assertThat(service.sellable(productId)).isGreaterThanOrEqualTo(0L);
  }

  private static void awaitAll(List<Future<?>> futures) {
    for (Future<?> f : futures) {
      try {
        f.get();
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    }
  }

  private static void shutdown(ExecutorService pool) {
    pool.shutdownNow();
  }
}
