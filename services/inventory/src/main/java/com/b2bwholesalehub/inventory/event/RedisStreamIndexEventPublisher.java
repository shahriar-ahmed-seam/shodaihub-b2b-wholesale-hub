package com.b2bwholesalehub.inventory.event;

import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import com.b2bwholesalehub.inventory.reservation.ReservationKeys;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Durable Redis Streams producer for {@code product.index} events (Design → Internal Eventing).
 *
 * <p>On UPSERT it loads the product and serializes the full search document into the {@code doc}
 * field the Search Service consumer expects; on DELETE it emits only the {@code productId}. This is
 * the production implementation that replaces {@link LoggingIndexEventPublisher} (marked {@link
 * Primary} so it is injected wherever an {@link IndexEventPublisher} is required).
 *
 * <p>Stream contract: {@code { op, productId, doc?, correlationId }} on stream {@code
 * product.index}; {@code doc} is a JSON string matching the Search {@code ProductDoc} model.
 */
@Component
@Primary
public class RedisStreamIndexEventPublisher implements IndexEventPublisher {

  /** Stream key fixed by the design and the Search consumer config. */
  static final String STREAM = "product.index";

  private static final Logger log = LoggerFactory.getLogger(RedisStreamIndexEventPublisher.class);

  private final StringRedisTemplate redis;
  private final ProductRepository productRepository;
  private final ObjectMapper objectMapper;

  public RedisStreamIndexEventPublisher(
      StringRedisTemplate redis, ProductRepository productRepository, ObjectMapper objectMapper) {
    this.redis = redis;
    this.productRepository = productRepository;
    this.objectMapper = objectMapper;
  }

  @Override
  public void publish(ProductIndexEvent event) {
    try {
      Map<String, String> fields = new LinkedHashMap<>();
      fields.put("productId", event.productId().toString());
      fields.put("correlationId", event.correlationId() == null ? "" : event.correlationId());

      if (event.op() == ProductIndexEvent.Op.DELETE) {
        fields.put("op", "delete");
      } else {
        fields.put("op", "upsert");
        Product product = productRepository.findById(event.productId()).orElse(null);
        if (product == null) {
          log.warn("Skipping upsert index event; product not found productId={}", event.productId());
          return;
        }
        fields.put("doc", buildDoc(product));
      }

      redis.opsForStream().add(STREAM, fields);
      log.info(
          "product.index published op={} productId={} correlationId={}",
          fields.get("op"),
          event.productId(),
          event.correlationId());
    } catch (Exception e) {
      // Indexing is best-effort relative to the write; a periodic reconcile repairs drift.
      log.error("Failed to publish product.index event productId={}", event.productId(), e);
    }
  }

  /** Serialize the product into the Search {@code ProductDoc} JSON shape. */
  private String buildDoc(Product product) throws Exception {
    int reserved = readReservedTotal(product);
    int sellable = Math.max(0, product.getAvailableStock() - reserved);

    Map<String, Object> doc = new LinkedHashMap<>();
    doc.put("productId", product.getId().toString());
    doc.put("supplierId", product.getSupplierId().toString());
    doc.put("name", product.getName());
    doc.put("description", product.getDescription() == null ? "" : product.getDescription());
    doc.put("category", product.getCategory());
    doc.put("basePrice", product.getBasePrice().doubleValue());
    doc.put("sellableQty", sellable);
    doc.put("status", product.getStatus().name());
    if (product.getAvgRating() != null) {
      doc.put("avgRating", product.getAvgRating().doubleValue());
    }
    doc.put("updatedAt", product.getUpdatedAt().toString());
    return objectMapper.writeValueAsString(doc);
  }

  private int readReservedTotal(Product product) {
    try {
      String rt = redis.opsForValue().get(ReservationKeys.reservedTotal(product.getId()));
      return rt == null || rt.isBlank() ? 0 : Integer.parseInt(rt.trim());
    } catch (RuntimeException e) {
      return 0;
    }
  }
}
