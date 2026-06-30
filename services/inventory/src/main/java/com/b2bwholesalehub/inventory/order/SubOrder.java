package com.b2bwholesalehub.inventory.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One supplier's independently fulfilled portion of a parent order. Records the supplier, retailer,
 * total, status, and (once shipped) a tracking reference. (Req 10.1, 10.3, 10.5, 12)
 */
@Entity
@Table(name = "sub_order")
public class SubOrder {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "order_id", nullable = false)
  private UUID orderId;

  @Column(name = "supplier_id", nullable = false)
  private UUID supplierId;

  @Column(name = "retailer_id", nullable = false)
  private UUID retailerId;

  @Column(name = "sub_order_total", nullable = false, precision = 12, scale = 2)
  private BigDecimal subOrderTotal;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private OrderStatus status;

  @Column(name = "tracking_reference")
  private String trackingReference;

  @Column(name = "status_changed_at", nullable = false)
  private Instant statusChangedAt;

  protected SubOrder() {}

  public SubOrder(
      UUID id,
      UUID orderId,
      UUID supplierId,
      UUID retailerId,
      BigDecimal subOrderTotal,
      OrderStatus status,
      Instant statusChangedAt) {
    this.id = id;
    this.orderId = orderId;
    this.supplierId = supplierId;
    this.retailerId = retailerId;
    this.subOrderTotal = subOrderTotal;
    this.status = status;
    this.statusChangedAt = statusChangedAt;
  }

  public UUID getId() {
    return id;
  }

  public UUID getOrderId() {
    return orderId;
  }

  public UUID getSupplierId() {
    return supplierId;
  }

  public UUID getRetailerId() {
    return retailerId;
  }

  public BigDecimal getSubOrderTotal() {
    return subOrderTotal;
  }

  public OrderStatus getStatus() {
    return status;
  }

  public void setStatus(OrderStatus status) {
    this.status = status;
  }

  public String getTrackingReference() {
    return trackingReference;
  }

  public void setTrackingReference(String trackingReference) {
    this.trackingReference = trackingReference;
  }

  public Instant getStatusChangedAt() {
    return statusChangedAt;
  }

  public void setStatusChangedAt(Instant statusChangedAt) {
    this.statusChangedAt = statusChangedAt;
  }
}
