package com.b2bwholesalehub.inventory.reservation;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Assume;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 5: Reservations never oversell stock (global concurrency
 * invariant) — for any randomized interleaving of reserve / release / renew / expire / convert
 * operations against a real Redis, the invariant
 *
 * <pre>sum(active reservations) + confirmed decrements &lt;= available_stock</pre>
 *
 * holds after every single operation, and {@code reserved_total} always equals the sum of the
 * quantities of the reservations that are still active.
 *
 * <p>**Validates: Requirements 7.1, 7.2, 7.8, 18.4**
 *
 * <p>Runs against a real {@code redis:7} container; aborts gracefully when Docker is unavailable.
 */
class OversellInvariantPropertyTest {

  private static final long TTL = 10_000L; // virtual-clock TTL

  private static final int RESERVE = 0;
  private static final int RELEASE = 1;
  private static final int RENEW = 2;
  private static final int CONVERT = 3;
  private static final int EXPIRE = 4;

  private record Op(int type, int qty, int delta) {}

  private record Active(String id, int qty, long expiresAt) {}

  @Property(tries = 150)
  void invariantHoldsAfterEveryOperation(
      @ForAll @IntRange(min = 1, max = 30) int initialStock, @ForAll("operations") List<Op> ops) {

    Assume.that(RedisTestSupport.DOCKER_AVAILABLE);
    RedisTestSupport.flush();

    ReservationService service = RedisTestSupport.newService(TTL, 3);
    UUID productId = UUID.randomUUID();
    UUID retailerId = UUID.randomUUID();
    service.syncStockMirror(productId, initialStock);

    List<Active> active = new ArrayList<>();
    long now = 1_000_000_000L;
    long converted = 0L;

    for (Op op : ops) {
      switch (op.type()) {
        case RESERVE -> {
          ReserveResult r = service.reserveAt(productId, retailerId, op.qty(), now, TTL);
          if (r.granted()) {
            active.add(new Active(r.reservationId(), op.qty(), now + TTL));
          }
        }
        case RELEASE -> {
          if (!active.isEmpty()) {
            Active hold = active.remove(Math.floorMod(op.qty(), active.size()));
            service.releaseAt(hold.id(), now);
          }
        }
        case RENEW -> {
          if (!active.isEmpty()) {
            int idx = Math.floorMod(op.qty(), active.size());
            Active hold = active.get(idx);
            RenewResult r = service.renewAt(hold.id(), now, TTL);
            if (r.renewed()) {
              active.set(idx, new Active(hold.id(), hold.qty(), now + TTL));
            }
          }
        }
        case CONVERT -> {
          if (!active.isEmpty()) {
            Active hold = active.remove(Math.floorMod(op.qty(), active.size()));
            ConvertResult r = service.convertAt(productId, hold.id(), hold.qty(), now);
            assertThat(r.converted()).isTrue(); // an active reservation always converts
            converted += hold.qty();
          }
        }
        case EXPIRE -> {
          now += op.delta();
          service.reapExpiredAt(productId, now);
        }
        default -> throw new IllegalStateException("unknown op " + op.type());
      }

      // Prune the model to match the script's lazy reconciliation at the current clock value, then
      // force Redis to reconcile too so both views agree.
      long clock = now;
      active.removeIf(a -> a.expiresAt() <= clock);
      long sellable = service.sellableAt(productId, now);
      long reserved = RedisTestSupport.readLong(ReservationKeys.reservedTotal(productId));
      long stock = RedisTestSupport.readLong(ReservationKeys.stock(productId));

      assertThat(reserved).isGreaterThanOrEqualTo(0L);
      assertThat(stock).isGreaterThanOrEqualTo(0L);
      // Core invariant: reserved units never exceed remaining stock => never oversell.
      assertThat(reserved).isLessThanOrEqualTo(stock);
      assertThat(sellable).isEqualTo(stock - reserved);
      assertThat(sellable).isGreaterThanOrEqualTo(0L);
      // Units are conserved: remaining stock + permanently converted == initial stock.
      assertThat(stock + converted).isEqualTo((long) initialStock);
      // reserved_total exactly tracks the active reservations.
      long modelReserved = active.stream().mapToLong(Active::qty).sum();
      assertThat(reserved).isEqualTo(modelReserved);
      // sum(active) + confirmed decrements <= available_stock (the design invariant, Req 7.8/18.4).
      assertThat(reserved + converted).isLessThanOrEqualTo((long) initialStock);
    }
  }

  @Provide
  Arbitrary<List<Op>> operations() {
    Arbitrary<Integer> type = Arbitraries.integers().between(RESERVE, EXPIRE);
    Arbitrary<Integer> qty = Arbitraries.integers().between(1, 10);
    Arbitrary<Integer> delta = Arbitraries.integers().between(1, 20_000);
    Arbitrary<Op> op = Combinators.combine(type, qty, delta).as(Op::new);
    return op.list().ofMaxSize(25);
  }
}
