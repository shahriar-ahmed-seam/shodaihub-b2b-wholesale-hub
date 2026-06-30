package com.b2bwholesalehub.inventory.supplier;

import com.b2bwholesalehub.inventory.common.NotFoundException;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Supplier KYC lifecycle. Submission moves a supplier to UNDER_REVIEW; admin approve/reject move it
 * to VERIFIED/REJECTED. Verification status is consumed by the publish gate. (Req 3.1, 3.3, 3.4)
 */
@Service
public class SupplierService {

  private final SupplierProfileRepository repository;

  public SupplierService(SupplierProfileRepository repository) {
    this.repository = repository;
  }

  /** Submit or resubmit KYC details; sets verification status to UNDER_REVIEW. (Req 3.1) */
  @Transactional
  public SupplierProfile submitKyc(
      UUID userId, String businessName, String tradeLicenseNo, String bankAccount) {
    SupplierProfile profile =
        repository
            .findByUserId(userId)
            .orElseGet(() -> new SupplierProfile(UUID.randomUUID(), userId, businessName));
    profile.setBusinessName(businessName);
    profile.setTradeLicenseNo(tradeLicenseNo);
    profile.setBankAccount(bankAccount);
    profile.setVerificationStatus(VerificationStatus.UNDER_REVIEW);
    profile.setRejectionReason(null);
    return repository.save(profile);
  }

  /** Administrator approves a KYC submission. (Req 3.3) */
  @Transactional
  public SupplierProfile approve(UUID supplierId) {
    SupplierProfile profile = require(supplierId);
    profile.setVerificationStatus(VerificationStatus.VERIFIED);
    profile.setRejectionReason(null);
    return repository.save(profile);
  }

  /** Administrator rejects a KYC submission with a reason. (Req 3.4) */
  @Transactional
  public SupplierProfile reject(UUID supplierId, String reason) {
    SupplierProfile profile = require(supplierId);
    profile.setVerificationStatus(VerificationStatus.REJECTED);
    profile.setRejectionReason(reason);
    return repository.save(profile);
  }

  @Transactional(readOnly = true)
  public SupplierProfile require(UUID supplierId) {
    return repository
        .findById(supplierId)
        .orElseThrow(() -> new NotFoundException("Supplier not found: " + supplierId));
  }
}
