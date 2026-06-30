package com.b2bwholesalehub.inventory.review;

import com.b2bwholesalehub.inventory.common.Identity;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Retailer product-review submission. (Req 15.1–15.3) */
@RestController
public class ReviewController {

  /** Review submission payload: a rating (1–5) and optional text. */
  public record ReviewRequest(int rating, String body) {}

  private final ReviewService reviewService;

  public ReviewController(ReviewService reviewService) {
    this.reviewService = reviewService;
  }

  @PostMapping("/products/{id}/reviews")
  public ResponseEntity<Review> submit(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId,
      @PathVariable UUID id,
      @RequestBody ReviewRequest request) {
    Review review = reviewService.submit(retailerId, id, request.rating(), request.body());
    return ResponseEntity.status(HttpStatus.CREATED).body(review);
  }
}
