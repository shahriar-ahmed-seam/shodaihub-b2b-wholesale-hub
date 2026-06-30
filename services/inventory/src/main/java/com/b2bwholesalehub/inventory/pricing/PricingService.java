package com.b2bwholesalehub.inventory.pricing;

import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import com.b2bwholesalehub.inventory.supplier.SupplierProfile;
import com.b2bwholesalehub.inventory.supplier.SupplierProfileRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Defines pricing tiers for a product. The validation-then-insert sequence runs inside a single
 * transaction holding a {@code FOR UPDATE} row lock on the product, so two concurrent tier
 * submissions cannot both insert overlapping ranges. A rejected candidate leaves existing tiers
 * unchanged. (Req 5.1–5.5; Design Deep-Dive 1)
 */
@Service
public class PricingService {

  private final ProductRepository productRepository;
  private final PricingTierRepository tierRepository;
  private final SupplierProfileRepository supplierRepository;

  public PricingService(
      ProductRepository productRepository,
      PricingTierRepository tierRepository,
      SupplierProfileRepository supplierRepository) {
    this.productRepository = productRepository;
    this.tierRepository = tierRepository;
    this.supplierRepository = supplierRepository;
  }

  @Transactional
  public PricingTierEntity addTier(
      UUID userId, UUID productId, int minQty, int maxQty, BigDecimal unitPrice) {

    // Serialize tier edits for this product (SELECT ... FOR UPDATE).
    Product product =
        productRepository
            .findByIdForUpdate(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

    SupplierProfile supplier =
        supplierRepository
            .findByUserId(userId)
            .orElseThrow(() -> new NotFoundException("No supplier profile for user: " + userId));
    if (!supplier.getId().equals(product.getSupplierId())) {
      throw new ForbiddenException("You do not own this product.");
    }

    TierRange candidate = new TierRange(minQty, maxQty, unitPrice);
    List<TierRange> existing =
        tierRepository.findByProductIdOrderByMinQtyAsc(productId).stream()
            .map(PricingTierEntity::toRange)
            .toList();

    // Throws on invalid fields or overlap; existing tiers are untouched because we have not
    // inserted.
    TierValidator.validateAgainstExisting(candidate, existing);

    PricingTierEntity entity =
        new PricingTierEntity(UUID.randomUUID(), productId, minQty, maxQty, unitPrice);
    return tierRepository.save(entity);
  }
}
