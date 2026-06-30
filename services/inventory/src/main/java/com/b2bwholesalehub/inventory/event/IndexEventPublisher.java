package com.b2bwholesalehub.inventory.event;

/**
 * Abstraction over emission of {@code product.index} events to the search index pipeline. Behind
 * this interface sits a Redis Streams {@code XADD} producer (wired in Milestone 5); tests
 * substitute an in-memory fake so domain behavior can be verified without Redis.
 */
public interface IndexEventPublisher {

  /** Emits a single product-index event. Must be idempotent-friendly (consumers dedup). */
  void publish(ProductIndexEvent event);
}
