package com.b2bwholesalehub.inventory.product;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.supplier.VerificationStatus;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

/**
 * Feature: b2b-wholesale-hub, Property 9: Publishing is gated by supplier verification — a publish
 * action is permitted if and only if the supplier's verification status is VERIFIED; suppliers in
 * PENDING_VERIFICATION, UNDER_REVIEW, or REJECTED are prevented from publishing.
 *
 * <p>**Validates: Requirements 3.2, 3.5, 4.4**
 */
class PublishGatePropertyTest {

  @Property(tries = 100)
  void publishAllowedIffVerified(@ForAll VerificationStatus status) {
    boolean canPublish = PublishGate.canPublish(status);
    assertThat(canPublish).isEqualTo(status == VerificationStatus.VERIFIED);
  }
}
