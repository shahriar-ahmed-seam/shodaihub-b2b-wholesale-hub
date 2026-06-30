package com.b2bwholesalehub.inventory.event;

import java.util.ArrayList;
import java.util.List;

/**
 * In-memory fake of {@link IndexEventPublisher} for tests. Records every emitted event so tests can
 * assert that (and how many) search-index events were produced without a live Redis. (Design →
 * "Redis Streams event emission behind an interface that can be faked in tests")
 */
public class RecordingIndexEventPublisher implements IndexEventPublisher {

  private final List<ProductIndexEvent> events = new ArrayList<>();

  @Override
  public void publish(ProductIndexEvent event) {
    events.add(event);
  }

  public List<ProductIndexEvent> events() {
    return List.copyOf(events);
  }

  public int count() {
    return events.size();
  }

  public void clear() {
    events.clear();
  }
}
