package com.b2bwholesalehub.inventory.pricing;

import com.b2bwholesalehub.inventory.common.Identity;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Pricing-tier definition endpoint. (Req 5.1–5.5) */
@RestController
public class PricingTierController {

  /** Tier-creation payload. */
  public record TierRequest(int minQty, int maxQty, BigDecimal unitPrice) {}

  private final PricingService pricingService;

  public PricingTierController(PricingService pricingService) {
    this.pricingService = pricingService;
  }

  @PostMapping("/products/{id}/tiers")
  public ResponseEntity<PricingTierEntity> addTier(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @PathVariable UUID id,
      @RequestBody TierRequest request) {
    PricingTierEntity tier =
        pricingService.addTier(userId, id, request.minQty(), request.maxQty(), request.unitPrice());
    return ResponseEntity.status(HttpStatus.CREATED).body(tier);
  }
}
