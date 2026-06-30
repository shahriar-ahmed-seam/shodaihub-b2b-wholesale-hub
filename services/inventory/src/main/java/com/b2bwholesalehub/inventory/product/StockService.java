package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.CorrelationId;
import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.event.IndexEventPublisher;
import com.b2bwholesalehub.inventory.event.ProductIndexEvent;
import com.b2bwholesalehub.inventory.reservation.ReservationService;
import com.b2bwholesalehub.inventory.supplier.SupplierProfile;
import com.b2bwholesalehub.inventory.supplier.SupplierProfileRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sets available stock for a product. Rejects negatives; when stock reaches zero the product
 * transitions to OUT_OF_STOCK and a search-index event is emitted. (Req 6.1, 6.2, 6.3)
 *
 * <p>After persisting, the Redis stock mirror is synchronized from the authoritative persistent
 * value so the reservation/locking scripts evaluate sellable quantity correctly (Req 6.4, 7.4).
 */
@Service
public class StockService {

  private final ProductRepository productRepository;
  private final SupplierProfileRepository supplierRepository;
  private final IndexEventPublisher indexEventPublisher;
  private final ReservationService reservationService;

  public StockService(
      ProductRepository productRepository,
      SupplierProfileRepository supplierRepository,
      IndexEventPublisher indexEventPublisher,
      ReservationService reservationService) {
    this.productRepository = productRepository;
    this.supplierRepository = supplierRepository;
    this.indexEventPublisher = indexEventPublisher;
    this.reservationService = reservationService;
  }

  @Transactional
  public Product setStock(UUID userId, UUID productId, int newStock) {
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

    StockManager.StockChangeResult result =
        StockManager.applyStockChange(product.getStatus(), newStock);
    product.setAvailableStock(result.stock());
    product.setStatus(result.status());
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);

    // Keep the Redis stock mirror aligned with the authoritative persistent value (Req 6.4, 7.4).
    reservationService.syncStockMirror(product.getId(), product.getAvailableStock());

    if (result.indexEventEmitted()) {
      indexEventPublisher.publish(
          ProductIndexEvent.upsert(product.getId(), CorrelationId.current()));
    }
    return product;
  }
}
