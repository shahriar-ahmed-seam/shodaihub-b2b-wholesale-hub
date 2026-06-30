package com.b2bwholesalehub.inventory.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * A parent order produced by a single checkout. It splits into one sub-order per supplier; its
 * total is the sum of all sub-order totals in BDT. (Req 10.2)
 */
@Entity
@Table(name = "orders")
public class OrderEntity {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "retailer_id", nullable = false)
  private UUID retailerId;

  @Column(name = "order_total", nullable = false, precision = 12, scale = 2)
  private BigDecimal orderTotal;

  @Column(name = "created_at", nullable = false)
  private Instant createdAt = Instant.now();

  protected OrderEntity() {}

  public OrderEntity(UUID id, UUID retailerId, BigDecimal orderTotal, Instant createdAt) {
    this.id = id;
    this.retailerId = retailerId;
    this.orderTotal = orderTotal;
    this.createdAt = createdAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getRetailerId() {
    return retailerId;
  }

  public BigDecimal getOrderTotal() {
    return orderTotal;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }
}
