package com.b2bwholesalehub.inventory.review;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * A retailer's product review: one rating (1–5) with optional text, allowed only after a delivered
 * sub-order. Hidden reviews are excluded from public display and from the average. (Req 15)
 */
@Entity
@Table(name = "review")
public class Review {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "product_id", nullable = false)
  private UUID productId;

  @Column(name = "retailer_id", nullable = false)
  private UUID retailerId;

  @Column(nullable = false)
  private int rating;

  @Column(columnDefinition = "text")
  private String body;

  @Column(nullable = false)
  private boolean hidden = false;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  protected Review() {}

  public Review(UUID id, UUID productId, UUID retailerId, int rating, String body) {
    this.id = id;
    this.productId = productId;
    this.retailerId = retailerId;
    this.rating = rating;
    this.body = body;
    this.hidden = false;
    this.createdAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getProductId() {
    return productId;
  }

  public UUID getRetailerId() {
    return retailerId;
  }

  public int getRating() {
    return rating;
  }

  public String getBody() {
    return body;
  }

  public boolean isHidden() {
    return hidden;
  }

  public void setHidden(boolean hidden) {
    this.hidden = hidden;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
