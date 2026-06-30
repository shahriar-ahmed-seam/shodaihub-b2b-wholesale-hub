package com.b2bwholesalehub.inventory.review;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.order.OrderLineRepository;
import com.b2bwholesalehub.inventory.order.OrderStatus;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Product reviews gated on delivery. A retailer may submit one rating (1–5) with optional text for
 * a product only if they have at least one DELIVERED sub-order for it; each submission recalculates
 * and stores the product's average rating over the visible reviews. (Req 15.1–15.3)
 */
@Service
public class ReviewService {

  private final ReviewRepository reviewRepository;
  private final ProductRepository productRepository;
  private final OrderLineRepository orderLineRepository;

  public ReviewService(
      ReviewRepository reviewRepository,
      ProductRepository productRepository,
      OrderLineRepository orderLineRepository) {
    this.reviewRepository = reviewRepository;
    this.productRepository = productRepository;
    this.orderLineRepository = orderLineRepository;
  }

  @Transactional
  public Review submit(UUID retailerId, UUID productId, int rating, String body) {
    if (!ReviewEligibility.isValidRating(rating)) {
      throw new ApiException(
          ErrorCode.REVIEW_RATING_ERROR,
          HttpStatus.BAD_REQUEST,
          "Rating must be an integer from 1 to 5.");
    }
    Product product =
        productRepository
            .findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));

    boolean alreadyReviewed =
        reviewRepository.existsByProductIdAndRetailerId(productId, retailerId);
    if (alreadyReviewed) {
      throw new ApiException(
          ErrorCode.REVIEW_ALREADY_EXISTS,
          HttpStatus.CONFLICT,
          "You have already reviewed this product.");
    }
    boolean hasDelivered =
        orderLineRepository
            .findProductIdsByRetailerAndSubOrderStatus(retailerId, OrderStatus.DELIVERED)
            .contains(productId);
    if (!ReviewEligibility.canReview(hasDelivered, false)) {
      throw new ApiException(
          ErrorCode.REVIEW_NOT_ELIGIBLE,
          HttpStatus.FORBIDDEN,
          "You can only review a product you have a delivered sub-order for.");
    }

    Review review = new Review(UUID.randomUUID(), productId, retailerId, rating, body);
    reviewRepository.save(review);
    recalculateAverage(product);
    return review;
  }

  /**
   * Recomputes and stores the product's average rating over its visible (non-hidden) reviews. (Req
   * 15.3, 15.4)
   */
  @Transactional
  public void recalculateAverage(UUID productId) {
    Product product =
        productRepository
            .findById(productId)
            .orElseThrow(() -> new NotFoundException("Product not found: " + productId));
    recalculateAverage(product);
  }

  private void recalculateAverage(Product product) {
    List<Integer> visible =
        reviewRepository.findByProductIdAndHiddenFalse(product.getId()).stream()
            .map(Review::getRating)
            .toList();
    BigDecimal average = RatingCalculator.average(visible);
    product.setAvgRating(average);
    productRepository.save(product);
  }
}
