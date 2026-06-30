package com.b2bwholesalehub.inventory.order;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * A single product line within a sub-order, recording the per-unit price and line subtotal frozen
 * at checkout, plus the reservation that backs it until payment converts or it is cancelled. (Req
 * 10.5, 12.5)
 */
@Entity
@Table(name = "order_line")
public class OrderLine {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "sub_order_id", nullable = false)
  private UUID subOrderId;

  @Column(name = "product_id", nullable = false)
  private UUID productId;

  @Column(nullable = false)
  private int quantity;

  @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
  private BigDecimal unitPrice;

  @Column(name = "line_subtotal", nullable = false, precision = 12, scale = 2)
  private BigDecimal lineSubtotal;

  @Column(name = "reservation_id")
  private String reservationId;

  protected OrderLine() {}

  public OrderLine(
      UUID id,
      UUID subOrderId,
      UUID productId,
      int quantity,
      BigDecimal unitPrice,
      BigDecimal lineSubtotal,
      String reservationId) {
    this.id = id;
    this.subOrderId = subOrderId;
    this.productId = productId;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.lineSubtotal = lineSubtotal;
    this.reservationId = reservationId;
  }

  public UUID getId() {
    return id;
  }

  public UUID getSubOrderId() {
    return subOrderId;
  }

  public UUID getProductId() {
    return productId;
  }

  public int getQuantity() {
    return quantity;
  }

  public BigDecimal getUnitPrice() {
    return unitPrice;
  }

  public BigDecimal getLineSubtotal() {
    return lineSubtotal;
  }

  public String getReservationId() {
    return reservationId;
  }
}
