package com.b2bwholesalehub.inventory.reservation;

import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.testcontainers.DockerClientFactory;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * Singleton {@code redis:7} Testcontainer shared by the reservation property/integration tests.
 *
 * <p>The container is started once in a static initializer and reused (Testcontainers reaps it at
 * JVM exit). Docker availability is probed up-front: when no Docker daemon is present, {@link
 * #DOCKER_AVAILABLE} is {@code false} and each test aborts via {@code Assume}, so the pure
 * unit/property suite still runs in container-less environments — the equivalent of {@code
 * disabledWithoutDocker} for the jqwik engine, which the JUnit Jupiter {@code @Testcontainers}
 * extension does not manage.
 */
public final class RedisTestSupport {

  public static final boolean DOCKER_AVAILABLE;

  private static final StringRedisTemplate TEMPLATE;

  static {
    boolean available;
    StringRedisTemplate template = null;
    try {
      available = DockerClientFactory.instance().isDockerAvailable();
    } catch (Throwable t) {
      available = false;
    }
    if (available) {
      try {
        GenericContainer<?> redis =
            new GenericContainer<>(DockerImageName.parse("redis:7"))
                .withExposedPorts(6379)
                // Enable keyspace expiry notifications so the secondary trigger is exercisable.
                .withCommand("redis-server", "--notify-keyspace-events", "Ex");
        redis.start();
        RedisStandaloneConfiguration config =
            new RedisStandaloneConfiguration(redis.getHost(), redis.getMappedPort(6379));
        LettuceConnectionFactory factory = new LettuceConnectionFactory(config);
        factory.afterPropertiesSet();
        factory.start();
        template = new StringRedisTemplate(factory);
        template.afterPropertiesSet();
      } catch (Throwable t) {
        available = false;
        template = null;
      }
    }
    DOCKER_AVAILABLE = available;
    TEMPLATE = template;
  }

  private RedisTestSupport() {}

  /**
   * Shared {@link StringRedisTemplate} bound to the container; {@code null} when Docker is absent.
   */
  public static StringRedisTemplate template() {
    return TEMPLATE;
  }

  /** A reservation service backed by the shared container with the given TTL and renewal cap. */
  public static ReservationService newService(long ttlMillis, int maxRenewals) {
    return new RedisReservationService(TEMPLATE, ttlMillis, maxRenewals);
  }

  /** Clears all keys between tries so per-try state is isolated. */
  public static void flush() {
    if (TEMPLATE == null) {
      return;
    }
    TEMPLATE.execute(
        (org.springframework.data.redis.core.RedisCallback<Object>)
            connection -> {
              connection.serverCommands().flushDb();
              return null;
            });
  }

  /** Reads a Redis integer value (stock mirror / reserved_total), treating a missing key as 0. */
  public static long readLong(String key) {
    String value = TEMPLATE.opsForValue().get(key);
    return value == null ? 0L : Long.parseLong(value);
  }
}
