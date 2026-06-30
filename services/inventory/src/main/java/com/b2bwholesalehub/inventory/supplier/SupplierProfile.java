package com.b2bwholesalehub.inventory.supplier;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** Supplier KYC record. Verification status gates publishing. (Req 3) */
@Entity
@Table(name = "supplier_profile")
public class SupplierProfile {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "user_id", nullable = false)
  private UUID userId;

  @Column(name = "business_name", nullable = false)
  private String businessName;

  @Column(name = "trade_license_no")
  private String tradeLicenseNo;

  @Column(name = "bank_account")
  private String bankAccount;

  @Enumerated(EnumType.STRING)
  @Column(name = "verification_status", nullable = false)
  private VerificationStatus verificationStatus = VerificationStatus.PENDING_VERIFICATION;

  @Column(name = "rejection_reason")
  private String rejectionReason;

  protected SupplierProfile() {}

  public SupplierProfile(UUID id, UUID userId, String businessName) {
    this.id = id;
    this.userId = userId;
    this.businessName = businessName;
  }

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public UUID getUserId() {
    return userId;
  }

  public void setUserId(UUID userId) {
    this.userId = userId;
  }

  public String getBusinessName() {
    return businessName;
  }

  public void setBusinessName(String businessName) {
    this.businessName = businessName;
  }

  public String getTradeLicenseNo() {
    return tradeLicenseNo;
  }

  public void setTradeLicenseNo(String tradeLicenseNo) {
    this.tradeLicenseNo = tradeLicenseNo;
  }

  public String getBankAccount() {
    return bankAccount;
  }

  public void setBankAccount(String bankAccount) {
    this.bankAccount = bankAccount;
  }

  public VerificationStatus getVerificationStatus() {
    return verificationStatus;
  }

  public void setVerificationStatus(VerificationStatus verificationStatus) {
    this.verificationStatus = verificationStatus;
  }

  public String getRejectionReason() {
    return rejectionReason;
  }

  public void setRejectionReason(String rejectionReason) {
    this.rejectionReason = rejectionReason;
  }
}
