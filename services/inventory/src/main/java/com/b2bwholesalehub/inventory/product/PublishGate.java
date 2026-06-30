package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.supplier.VerificationStatus;

/**
 * Pure publishing-eligibility rule: a product may be published if and only if its owning supplier's
 * verification status is VERIFIED. Suppliers in PENDING_VERIFICATION or UNDER_REVIEW (or REJECTED)
 * are prevented from publishing. (Req 3.2, 3.5, 4.4)
 */
public final class PublishGate {

  private PublishGate() {}

  public static boolean canPublish(VerificationStatus status) {
    return status == VerificationStatus.VERIFIED;
  }
}
