package com.b2bwholesalehub.inventory.supplier;

import jakarta.validation.constraints.NotBlank;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Administrator KYC moderation. (Req 3.3, 3.4, 16.1) */
@RestController
@RequestMapping("/admin/suppliers")
public class AdminSupplierController {

  /** Rejection payload carrying the required reason. */
  public record RejectRequest(@NotBlank String reason) {}

  private final SupplierService supplierService;

  public AdminSupplierController(SupplierService supplierService) {
    this.supplierService = supplierService;
  }

  @PostMapping("/{id}/kyc/approve")
  public ResponseEntity<SupplierProfile> approve(@PathVariable UUID id) {
    return ResponseEntity.ok(supplierService.approve(id));
  }

  @PostMapping("/{id}/kyc/reject")
  public ResponseEntity<SupplierProfile> reject(
      @PathVariable UUID id, @RequestBody RejectRequest request) {
    return ResponseEntity.ok(supplierService.reject(id, request.reason()));
  }
}
