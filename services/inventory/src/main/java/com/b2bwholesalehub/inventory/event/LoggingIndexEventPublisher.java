package com.b2bwholesalehub.inventory.event;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Default {@link IndexEventPublisher} used in Milestone 4. It records the emission point for {@code
 * product.index} events by logging them with their correlation id. The durable Redis Streams {@code
 * XADD} producer replaces this implementation in Milestone 5 (reservation/eventing work) without
 * any change to the calling services, which depend only on the interface.
 */
@Component
public class LoggingIndexEventPublisher implements IndexEventPublisher {

  private static final Logger log = LoggerFactory.getLogger(LoggingIndexEventPublisher.class);

  @Override
  public void publish(ProductIndexEvent event) {
    log.info(
        "product.index event op={} productId={} correlationId={}",
        event.op(),
        event.productId(),
        event.correlationId());
  }
}
