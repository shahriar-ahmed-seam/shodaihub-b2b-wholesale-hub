package com.b2bwholesalehub.inventory.order;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Pure status-history helper. No database, no Spring — directly unit- and property-testable.
 *
 * <p>The "most recent status change" displayed for a sub-order is the maximum {@code changed_at}
 * across that sub-order's status history (Property 24). (Req 13.3)
 */
public final class StatusTimeline {

  private StatusTimeline() {}

  /** The latest of the given status-change timestamps, or empty when there are none. */
  public static Optional<Instant> latestChange(List<Instant> changedAts) {
    return changedAts.stream().max(Instant::compareTo);
  }

  /** The latest {@code changed_at} across a sub-order's status history, or empty when none. */
  public static Optional<Instant> latestChangeOf(List<StatusHistory> history) {
    return history.stream().map(StatusHistory::getChangedAt).max(Instant::compareTo);
  }
}
