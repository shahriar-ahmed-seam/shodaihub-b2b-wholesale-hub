package com.b2bwholesalehub.inventory.admin;

import com.b2bwholesalehub.inventory.common.CorrelationId;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.event.IndexEventPublisher;
import com.b2bwholesalehub.inventory.event.ProductIndexEvent;
import com.b2bwholesalehub.inventory.order.OrderRepository;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import com.b2bwholesalehub.inventory.review.Review;
import com.b2bwholesalehub.inventory.review.ReviewRepository;
import com.b2bwholesalehub.inventory.review.ReviewService;
import com.b2bwholesalehub.inventory.supplier.SupplierProfileRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Administrator moderation and metrics: hide a review (and recalculate the product average), remove
 * a product (REMOVED + de-index), and report marketplace counts. (Req 15.4, 16.4, 16.5)
 */
@Service
public class AdminService {

  private final ReviewRepository reviewRepository;
  private final ReviewService reviewService;
  private final ProductRepository productRepository;
  private final SupplierProfileRepository supplierRepository;
  private final OrderRepository orderRepository;
  private final IndexEventPublisher indexEventPublisher;

  public AdminService(
      ReviewRepository reviewRepository,
      ReviewService reviewService,
      ProductRepository productRepository,
      SupplierProfileRepository supplierRepository,
      OrderRepository orderRepository,
      IndexEventPublisher indexEventPublisher) {
    this.reviewRepository = reviewRepository;
    this.reviewService = reviewService;
    this.productRepository = productRepository;
    this.supplierRepository = supplierRepository;
    this.orderRepository = orderRepository;
    this.indexEventPublisher = indexEventPublisher;
  }

  /** Hides a policy-violating review and recalculates the product's average rating. (Req 15.4) */
  @Transactional
  public void removeReview(UUID reviewId) {
    Review review =
        reviewRepository
            .findById(reviewId)
            .orElseThrow(() -> new NotFoundException("Review not found: " + reviewId));
    review.setHidden(true);
    reviewRepository.save(review);
    reviewService.recalculateAverage(review.getProductId());
  }

  /** Removes a policy-violating product (status REMOVED) and emits a de-index event. (Req 16.4) */
  @Transactional
  public Product removeProduct(UUID productId) {
    Product product =
        productRepository
            .findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
    AdminProductRemoval.Result result = AdminProductRemoval.remove(product.getStatus());
    product.setStatus(result.status());
    product.setUpdatedAt(Instant.now());
    productRepository.save(product);
    if (result.indexOp() == ProductIndexEvent.Op.DELETE) {
      indexEventPublisher.publish(
          ProductIndexEvent.delete(product.getId(), CorrelationId.current()));
    }
    return product;
  }

  /** Marketplace counts for the admin dashboard. (Req 16.5) */
  @Transactional(readOnly = true)
  public MarketplaceMetrics metrics() {
    return new MarketplaceMetrics(
        supplierRepository.count(),
        orderRepository.countDistinctRetailers(),
        productRepository.count(),
        orderRepository.count());
  }
}
