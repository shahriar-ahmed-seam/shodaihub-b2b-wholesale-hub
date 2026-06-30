package com.b2bwholesalehub.inventory.supplier;

/** Supplier KYC verification lifecycle. Only VERIFIED suppliers may publish products. (Req 3) */
public enum VerificationStatus {
  PENDING_VERIFICATION,
  UNDER_REVIEW,
  VERIFIED,
  REJECTED
}
