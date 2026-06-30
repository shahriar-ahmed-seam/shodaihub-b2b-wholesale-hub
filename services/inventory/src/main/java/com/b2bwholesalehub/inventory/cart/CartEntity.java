package com.b2bwholesalehub.inventory.cart;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** A retailer's shopping cart. A cart may hold line items from many suppliers. (Req 9.4) */
@Entity
@Table(name = "cart")
public class CartEntity {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "retailer_id", nullable = false)
  private UUID retailerId;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  protected CartEntity() {}

  public CartEntity(UUID id, UUID retailerId) {
    this.id = id;
    this.retailerId = retailerId;
    this.updatedAt = Instant.now();
  }

  public UUID getId() {
    return id;
  }

  public UUID getRetailerId() {
    return retailerId;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
