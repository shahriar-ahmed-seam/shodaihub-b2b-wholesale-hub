package com.b2bwholesalehub.inventory.event;

import java.util.UUID;

/**
 * A {@code product.index} event destined for the Search Service via Redis Streams. The payload
 * mirrors the design's stream contract: an operation, the product id, and the originating
 * correlation id. (Design → Internal Eventing)
 *
 * @param op whether the document should be upserted or deleted from the index
 * @param productId the affected product
 * @param correlationId the request correlation id for end-to-end tracing
 */
public record ProductIndexEvent(Op op, UUID productId, String correlationId) {

  /** Index operation. */
  public enum Op {
    UPSERT,
    DELETE
  }

  public static ProductIndexEvent upsert(UUID productId, String correlationId) {
    return new ProductIndexEvent(Op.UPSERT, productId, correlationId);
  }

  public static ProductIndexEvent delete(UUID productId, String correlationId) {
    return new ProductIndexEvent(Op.DELETE, productId, correlationId);
  }
}
