package com.b2bwholesalehub.inventory.reservation;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.listener.PatternTopic;
import org.springframework.data.redis.listener.RedisMessageListenerContainer;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Wires the reservation background machinery: the scheduled reaper (via {@link EnableScheduling})
 * and the optional keyspace-notification expiry listener (Deep-Dive 2 → TTL-based expiry; Req 7.5).
 */
@Configuration
@EnableScheduling
public class ReservationConfig {

  /**
   * Subscribes to {@code __keyevent@*__:expired} so expired reservation hashes kick a reaper sweep.
   * Best-effort and resilient: if the Redis server is not configured to emit keyspace events (or is
   * unreachable), the container simply never delivers messages and the scheduled reaper still
   * guarantees timely reconciliation. Enabled by default; toggle with {@code
   * reservation.keyspace-notifications.enabled}.
   */
  @Bean
  @ConditionalOnProperty(
      prefix = "reservation.keyspace-notifications",
      name = "enabled",
      havingValue = "true",
      matchIfMissing = true)
  public RedisMessageListenerContainer reservationExpiryListenerContainer(
      RedisConnectionFactory connectionFactory, ReservationService reservationService) {
    RedisMessageListenerContainer container = new RedisMessageListenerContainer();
    container.setConnectionFactory(connectionFactory);
    container.addMessageListener(
        new ReservationExpiryListener(reservationService),
        new PatternTopic("__keyevent@*__:expired"));
    return container;
  }
}
