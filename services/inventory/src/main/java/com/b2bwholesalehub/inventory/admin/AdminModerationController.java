package com.b2bwholesalehub.inventory.admin;

import com.b2bwholesalehub.inventory.product.Product;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/** Administrator moderation and metrics endpoints. (Req 15.4, 16.4, 16.5) */
@RestController
public class AdminModerationController {

  private final AdminService adminService;

  public AdminModerationController(AdminService adminService) {
    this.adminService = adminService;
  }

  @DeleteMapping("/admin/reviews/{id}")
  public ResponseEntity<Void> removeReview(@PathVariable UUID id) {
    adminService.removeReview(id);
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/admin/products/{id}/remove")
  public ResponseEntity<Product> removeProduct(@PathVariable UUID id) {
    return ResponseEntity.ok(adminService.removeProduct(id));
  }

  @GetMapping("/admin/metrics")
  public ResponseEntity<MarketplaceMetrics> metrics() {
    return ResponseEntity.ok(adminService.metrics());
  }
}
