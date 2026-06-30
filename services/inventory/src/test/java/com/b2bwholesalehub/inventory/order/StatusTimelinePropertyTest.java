package com.b2bwholesalehub.inventory.order;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;

/**
 * Feature: b2b-wholesale-hub, Property 24: Displayed status timestamp is the latest status change —
 * for any sub-order with a history of status changes, the displayed "most recent status change"
 * timestamp equals the maximum changed_at across that sub-order's status history.
 *
 * <p>**Validates: Requirements 13.3**
 */
class StatusTimelinePropertyTest {

  @Property(tries = 200)
  void latestChangeIsTheMaximumChangedAt(@ForAll("millisList") List<Long> millis) {

    List<Instant> changedAts = millis.stream().map(Instant::ofEpochMilli).toList();

    Optional<Instant> latest = StatusTimeline.latestChange(changedAts);

    Instant expectedMax = changedAts.get(0);
    for (Instant t : changedAts) {
      if (t.isAfter(expectedMax)) {
        expectedMax = t;
      }
    }
    assertThat(latest).contains(expectedMax);
    // The displayed timestamp is >= every recorded change.
    Instant displayed = latest.orElseThrow();
    for (Instant t : changedAts) {
      assertThat(displayed).isAfterOrEqualTo(t);
    }
  }

  @Property(tries = 100)
  void emptyHistoryHasNoLatestChange() {
    assertThat(StatusTimeline.latestChange(List.of())).isEmpty();
  }

  @Provide
  Arbitrary<List<Long>> millisList() {
    return Arbitraries.longs().between(0L, 4_102_444_800_000L).list().ofMinSize(1).ofMaxSize(30);
  }
}
