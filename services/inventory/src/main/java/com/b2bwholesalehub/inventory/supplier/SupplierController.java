package com.b2bwholesalehub.inventory.supplier;

import com.b2bwholesalehub.inventory.common.Identity;
import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Supplier-facing KYC submission. (Req 3.1) */
@RestController
@RequestMapping("/suppliers")
public class SupplierController {

  /** KYC submission payload. */
  public record KycRequest(
      @NotBlank String businessName, String tradeLicenseNo, String bankAccount) {}

  private final SupplierService supplierService;

  public SupplierController(SupplierService supplierService) {
    this.supplierService = supplierService;
  }

  @PostMapping("/kyc")
  public ResponseEntity<SupplierProfile> submitKyc(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @RequestBody KycRequest request) {
    SupplierProfile profile =
        supplierService.submitKyc(
            userId, request.businessName(), request.tradeLicenseNo(), request.bankAccount());
    return ResponseEntity.status(HttpStatus.ACCEPTED).body(profile);
  }
}
