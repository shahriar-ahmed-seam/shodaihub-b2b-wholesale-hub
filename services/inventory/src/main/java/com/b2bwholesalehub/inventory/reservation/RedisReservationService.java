package com.b2bwholesalehub.inventory.reservation;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.Cursor;
import org.springframework.data.redis.core.ScanOptions;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Redis-backed {@link ReservationService}. Every mutation is a single atomic Lua {@code EVAL}, the
 * sole atomicity boundary (Deep-Dive 2). The scripts perform lazy expiry reconciliation, the
 * sellable check, and the mutation in one indivisible step, so concurrent reserves for the last
 * unit are serialized and the oversell invariant always holds (Req 7.1, 7.2, 7.8, 18.4).
 */
@Service
public class RedisReservationService implements ReservationService {

  private final StringRedisTemplate redis;
  private final long ttlMillis;
  private final int maxRenewals;

  private final RedisScript<List> reserveScript = listScript("redis/reserve.lua");
  private final RedisScript<Long> releaseScript = longScript("redis/release.lua");
  private final RedisScript<List> renewScript = listScript("redis/renew.lua");
  private final RedisScript<List> convertScript = listScript("redis/convert.lua");
  private final RedisScript<Long> reapScript = longScript("redis/reap.lua");
  private final RedisScript<Long> sellableScript = longScript("redis/sellable.lua");
  private final RedisScript<Long> activeScript = longScript("redis/active.lua");

  public RedisReservationService(
      StringRedisTemplate redis,
      @Value("${reservation.ttl-millis:900000}") long ttlMillis,
      @Value("${reservation.max-renewals:3}") int maxRenewals) {
    this.redis = redis;
    this.ttlMillis = ttlMillis;
    this.maxRenewals = maxRenewals;
  }

  @SuppressWarnings("rawtypes")
  private static RedisScript<List> listScript(String location) {
    DefaultRedisScript<List> script = new DefaultRedisScript<>();
    script.setLocation(new ClassPathResource(location));
    script.setResultType(List.class);
    return script;
  }

  private static RedisScript<Long> longScript(String location) {
    DefaultRedisScript<Long> script = new DefaultRedisScript<>();
    script.setLocation(new ClassPathResource(location));
    script.setResultType(Long.class);
    return script;
  }

  @Override
  public void syncStockMirror(UUID productId, int stock) {
    redis.opsForValue().set(ReservationKeys.stock(productId), Integer.toString(stock));
  }

  @Override
  public ReserveResult reserve(UUID productId, UUID retailerId, int qty) {
    return reserveAt(productId, retailerId, qty, System.currentTimeMillis(), ttlMillis);
  }

  @Override
  public ReserveResult reserveAt(
      UUID productId, UUID retailerId, int qty, long nowMillis, long ttlMillis) {
    validateQuantity(qty);
    String reservationId = UUID.randomUUID().toString();
    List<String> keys =
        List.of(
            ReservationKeys.stock(productId),
            ReservationKeys.reservedTotal(productId),
            ReservationKeys.reservationSet(productId),
            ReservationKeys.reservationHash(reservationId));
    @SuppressWarnings("unchecked")
    List<Long> result =
        redis.execute(
            reserveScript,
            keys,
            Integer.toString(qty),
            reservationId,
            retailerId.toString(),
            Long.toString(ttlMillis),
            Long.toString(nowMillis),
            productId.toString());
    boolean granted = asLong(result.get(0)) == 1L;
    long sellable = asLong(result.get(1));
    return granted
        ? ReserveResult.granted(reservationId, sellable)
        : ReserveResult.rejected(sellable);
  }

  @Override
  public long release(String reservationId) {
    return releaseAt(reservationId, System.currentTimeMillis());
  }

  @Override
  public long releaseAt(String reservationId, long nowMillis) {
    Long freed =
        redis.execute(
            releaseScript,
            List.of(ReservationKeys.reservationHash(reservationId)),
            Long.toString(nowMillis));
    return freed == null ? 0L : freed;
  }

  @Override
  public RenewResult renew(String reservationId) {
    return renewAt(reservationId, System.currentTimeMillis(), ttlMillis);
  }

  @Override
  public RenewResult renewAt(String reservationId, long nowMillis, long ttlMillis) {
    @SuppressWarnings("unchecked")
    List<Long> result =
        redis.execute(
            renewScript,
            List.of(ReservationKeys.reservationHash(reservationId)),
            Long.toString(ttlMillis),
            Long.toString(nowMillis),
            Integer.toString(maxRenewals));
    boolean renewed = asLong(result.get(0)) == 1L;
    int renewals = (int) asLong(result.get(1));
    long expiresAt = asLong(result.get(2));
    return new RenewResult(renewed, renewals, expiresAt);
  }

  @Override
  public ConvertResult convert(UUID productId, String reservationId, int qty) {
    return convertAt(productId, reservationId, qty, System.currentTimeMillis());
  }

  @Override
  public ConvertResult convertAt(UUID productId, String reservationId, int qty, long nowMillis) {
    List<String> keys =
        List.of(
            ReservationKeys.stock(productId),
            ReservationKeys.reservedTotal(productId),
            ReservationKeys.reservationSet(productId),
            ReservationKeys.reservationHash(reservationId));
    @SuppressWarnings("unchecked")
    List<Long> result =
        redis.execute(convertScript, keys, Integer.toString(qty), Long.toString(nowMillis));
    boolean converted = asLong(result.get(0)) == 1L;
    long value = asLong(result.get(1));
    return new ConvertResult(converted, value);
  }

  @Override
  public boolean isActive(String reservationId) {
    return isActiveAt(reservationId, System.currentTimeMillis());
  }

  @Override
  public boolean isActiveAt(String reservationId, long nowMillis) {
    Long active =
        redis.execute(
            activeScript,
            List.of(ReservationKeys.reservationHash(reservationId)),
            Long.toString(nowMillis));
    return active != null && active == 1L;
  }

  @Override
  public long sellable(UUID productId) {
    return sellableAt(productId, System.currentTimeMillis());
  }

  @Override
  public long sellableAt(UUID productId, long nowMillis) {
    Long value =
        redis.execute(
            sellableScript,
            List.of(
                ReservationKeys.stock(productId),
                ReservationKeys.reservedTotal(productId),
                ReservationKeys.reservationSet(productId)),
            Long.toString(nowMillis));
    return value == null ? 0L : value;
  }

  @Override
  public long reapExpiredAt(UUID productId, long nowMillis) {
    Long reclaimed =
        redis.execute(
            reapScript,
            List.of(
                ReservationKeys.reservedTotal(productId),
                ReservationKeys.reservationSet(productId)),
            Long.toString(nowMillis));
    return reclaimed == null ? 0L : reclaimed;
  }

  @Override
  public long reapAll() {
    long now = System.currentTimeMillis();
    long reclaimed = 0L;
    List<String> setKeys = new ArrayList<>();
    ScanOptions options =
        ScanOptions.scanOptions().match("product:*:reservations").count(256).build();
    try (Cursor<String> cursor = redis.scan(options)) {
      while (cursor.hasNext()) {
        setKeys.add(cursor.next());
      }
    }
    for (String setKey : setKeys) {
      Long perProduct =
          redis.execute(
              reapScript,
              List.of(ReservationKeys.reservedTotalFromSetKey(setKey), setKey),
              Long.toString(now));
      if (perProduct != null) {
        reclaimed += perProduct;
      }
    }
    return reclaimed;
  }

  private static void validateQuantity(int qty) {
    if (qty < 1) {
      throw new ApiException(
          ErrorCode.RESERVATION_QUANTITY_ERROR,
          HttpStatus.BAD_REQUEST,
          "Reservation quantity must be an integer of at least 1.",
          List.of(new FieldIssue("quantity", "must be >= 1")));
    }
  }

  private static long asLong(Object value) {
    return ((Number) value).longValue();
  }
}
