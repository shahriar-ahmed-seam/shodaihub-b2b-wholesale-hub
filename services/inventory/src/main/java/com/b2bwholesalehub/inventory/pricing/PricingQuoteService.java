package com.b2bwholesalehub.inventory.pricing;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Resolves a per-unit price for a quantity and computes the line subtotal, delegating to the pure
 * {@link PriceResolver}. (Req 5.6, 5.7, 5.8)
 */
@Service
public class PricingQuoteService {

  /**
   * @param unitPrice resolved per-unit price in BDT
   * @param quantity requested quantity
   * @param subtotal line subtotal rounded half-up to 2 decimals
   */
  public record Quote(BigDecimal unitPrice, int quantity, BigDecimal subtotal) {}

  private final ProductRepository productRepository;
  private final PricingTierRepository tierRepository;

  public PricingQuoteService(
      ProductRepository productRepository, PricingTierRepository tierRepository) {
    this.productRepository = productRepository;
    this.tierRepository = tierRepository;
  }

  @Transactional(readOnly = true)
  public Quote quote(UUID productId, int quantity) {
    if (quantity < 1) {
      throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          HttpStatus.BAD_REQUEST,
          "Quantity must be a positive integer.");
    }
    Product product =
        productRepository
            .findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
    List<TierRange> tiers =
        tierRepository.findByProductIdOrderByMinQtyAsc(productId).stream()
            .map(PricingTierEntity::toRange)
            .toList();
    BigDecimal unitPrice = PriceResolver.resolveUnitPrice(product.getBasePrice(), tiers, quantity);
    BigDecimal subtotal =
        com.b2bwholesalehub.inventory.common.Money.lineSubtotal(unitPrice, quantity);
    return new Quote(unitPrice, quantity, subtotal);
  }
}
