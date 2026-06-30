package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.CorrelationId;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.event.IndexEventPublisher;
import com.b2bwholesalehub.inventory.event.ProductIndexEvent;
import com.b2bwholesalehub.inventory.supplier.SupplierProfile;
import com.b2bwholesalehub.inventory.supplier.SupplierProfileRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Product catalog management: creation with validation, lifecycle transitions, and emission of
 * search-index events. Publishing is gated by supplier verification, and every mutation enforces
 * supplier ownership. (Req 4, 3.2, 3.5, 2.4)
 */
@Service
public class ProductService {

  private final ProductRepository productRepository;
  private final ProductImageRepository imageRepository;
  private final SupplierProfileRepository supplierRepository;
  private final IndexEventPublisher indexEventPublisher;

  public ProductService(
      ProductRepository productRepository,
      ProductImageRepository imageRepository,
      SupplierProfileRepository supplierRepository,
      IndexEventPublisher indexEventPublisher) {
    this.productRepository = productRepository;
    this.imageRepository = imageRepository;
    this.supplierRepository = supplierRepository;
    this.indexEventPublisher = indexEventPublisher;
  }

  /** Creates a DRAFT product owned by the submitting supplier after validation. (Req 4.1–4.3) */
  @Transactional
  public Product create(
      UUID userId,
      String name,
      String description,
      String category,
      BigDecimal basePrice,
      Integer moq,
      List<String> imageUrls) {

    int imageCount = imageUrls == null ? 0 : imageUrls.size();
    ProductDraft draft = new ProductDraft(name, basePrice, moq, category, imageCount);
    List<FieldIssue> issues = ProductValidator.validate(draft);
    if (!issues.isEmpty()) {
      throw new ApiException(
          errorCodeFor(issues), HttpStatus.BAD_REQUEST, errorMessage(issues), issues);
    }

    SupplierProfile supplier = requireSupplierForUser(userId);

    Product product = new Product();
    product.setId(UUID.randomUUID());
    product.setSupplierId(supplier.getId());
    product.setName(name);
    product.setDescription(description);
    product.setCategory(category);
    product.setBasePrice(basePrice.setScale(2, java.math.RoundingMode.HALF_UP));
    product.setMoq(moq);
    product.setAvailableStock(0);
    product.setStatus(ProductStatus.DRAFT);
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);

    int order = 0;
    for (String url : imageUrls) {
      imageRepository.save(new ProductImage(UUID.randomUUID(), product.getId(), url, order++));
    }
    return product;
  }

  /** Publishes a DRAFT/UNPUBLISHED product, gated by supplier verification. (Req 4.4, 3.2, 3.5) */
  @Transactional
  public Product publish(UUID userId, UUID productId) {
    Product product = requireOwned(userId, productId);
    SupplierProfile supplier = requireSupplier(product.getSupplierId());
    if (!PublishGate.canPublish(supplier.getVerificationStatus())) {
      throw new ApiException(
          ErrorCode.PUBLISH_NOT_VERIFIED,
          HttpStatus.FORBIDDEN,
          "Supplier must be VERIFIED to publish products.");
    }
    product.setStatus(ProductStatus.PUBLISHED);
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);
    indexEventPublisher.publish(ProductIndexEvent.upsert(product.getId(), CorrelationId.current()));
    return product;
  }

  /**
   * Persists an update to a product; re-indexes when the product is currently PUBLISHED. (Req 4.5)
   */
  @Transactional
  public Product update(
      UUID userId, UUID productId, String name, String description, String category) {
    Product product = requireOwned(userId, productId);
    if (name != null) {
      product.setName(name);
    }
    if (description != null) {
      product.setDescription(description);
    }
    if (category != null) {
      product.setCategory(category);
    }
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);
    if (product.getStatus() == ProductStatus.PUBLISHED) {
      indexEventPublisher.publish(
          ProductIndexEvent.upsert(product.getId(), CorrelationId.current()));
    }
    return product;
  }

  /** Unpublishes a product and requests its removal from the public index. (Req 4.6) */
  @Transactional
  public Product unpublish(UUID userId, UUID productId) {
    Product product = requireOwned(userId, productId);
    product.setStatus(ProductStatus.UNPUBLISHED);
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);
    indexEventPublisher.publish(ProductIndexEvent.delete(product.getId(), CorrelationId.current()));
    return product;
  }

  /** Paginated list of the supplier's own products. (Req 4.7) */
  @Transactional(readOnly = true)
  public Page<Product> listOwnProducts(UUID userId, Pageable pageable) {
    SupplierProfile supplier = requireSupplierForUser(userId);
    return productRepository.findBySupplierId(supplier.getId(), pageable);
  }

  // --- helpers ---

  private Product requireOwned(UUID userId, UUID productId) {
    Product product =
        productRepository
            .findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
    SupplierProfile supplier = requireSupplierForUser(userId);
    if (!supplier.getId().equals(product.getSupplierId())) {
      throw new ForbiddenException("You do not own this product.");
    }
    return product;
  }

  private SupplierProfile requireSupplierForUser(UUID userId) {
    return supplierRepository
        .findByUserId(userId)
        .orElseThrow(() -> new NotFoundException("No supplier profile for user: " + userId));
  }

  private SupplierProfile requireSupplier(UUID supplierId) {
    return supplierRepository
        .findById(supplierId)
        .orElseThrow(() -> new NotFoundException("Supplier not found: " + supplierId));
  }

  private static ErrorCode errorCodeFor(List<FieldIssue> issues) {
    boolean onlyPricing =
        issues.size() == 1
            && issues.get(0).field().equals(ProductValidator.BASE_PRICE)
            && issues.get(0).issue().contains("greater than zero");
    return onlyPricing ? ErrorCode.PRICING_VALIDATION_ERROR : ErrorCode.VALIDATION_ERROR;
  }

  private static String errorMessage(List<FieldIssue> issues) {
    return errorCodeFor(issues) == ErrorCode.PRICING_VALIDATION_ERROR
        ? "Base price must be greater than zero."
        : "Product submission is missing or has invalid required fields.";
  }
}
