package com.b2bwholesalehub.inventory.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/**
 * An append-only record of each sub-order status change, used to display fulfillment progress. (Req
 * 13.3)
 */
@Entity
@Table(name = "status_history")
public class StatusHistory {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "sub_order_id", nullable = false)
  private UUID subOrderId;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OrderStatus status;

  @Column(name = "changed_at", nullable = false)
  private Instant changedAt;

  protected StatusHistory() {}

  public StatusHistory(UUID id, UUID subOrderId, OrderStatus status, Instant changedAt) {
    this.id = id;
    this.subOrderId = subOrderId;
    this.status = status;
    this.changedAt = changedAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getSubOrderId() {
    return subOrderId;
  }

  public OrderStatus getStatus() {
    return status;
  }

  public Instant getChangedAt() {
    return changedAt;
  }
}
