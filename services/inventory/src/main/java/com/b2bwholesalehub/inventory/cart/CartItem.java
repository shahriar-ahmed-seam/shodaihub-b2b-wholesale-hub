package com.b2bwholesalehub.inventory.cart;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * A single product line within a cart, carrying the resolved per-unit price, the subtotal, and the
 * id of the Redis reservation holding its stock. Money is {@code NUMERIC(12,2)}. (Req 9.1, 9.3,
 * 7.1)
 */
@Entity
@Table(name = "cart_item")
public class CartItem {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "cart_id", nullable = false)
  private UUID cartId;

  @Column(name = "product_id", nullable = false)
  private UUID productId;

  @Column(name = "supplier_id", nullable = false)
  private UUID supplierId;

  @Column(nullable = false)
  private int quantity;

  @Column(name = "resolved_unit_price", nullable = false, precision = 12, scale = 2)
  private BigDecimal resolvedUnitPrice;

  @Column(nullable = false, precision = 12, scale = 2)
  private BigDecimal subtotal;

  @Column(name = "reservation_id")
  private String reservationId;

  protected CartItem() {}

  public CartItem(
      UUID id,
      UUID cartId,
      UUID productId,
      UUID supplierId,
      int quantity,
      BigDecimal resolvedUnitPrice,
      BigDecimal subtotal,
      String reservationId) {
    this.id = id;
    this.cartId = cartId;
    this.productId = productId;
    this.supplierId = supplierId;
    this.quantity = quantity;
    this.resolvedUnitPrice = resolvedUnitPrice;
    this.subtotal = subtotal;
    this.reservationId = reservationId;
  }

  public UUID getId() {
    return id;
  }

  public UUID getCartId() {
    return cartId;
  }

  public UUID getProductId() {
    return productId;
  }

  public UUID getSupplierId() {
    return supplierId;
  }

  public int getQuantity() {
    return quantity;
  }

  public void setQuantity(int quantity) {
    this.quantity = quantity;
  }

  public BigDecimal getResolvedUnitPrice() {
    return resolvedUnitPrice;
  }

  public void setResolvedUnitPrice(BigDecimal resolvedUnitPrice) {
    this.resolvedUnitPrice = resolvedUnitPrice;
  }

  public BigDecimal getSubtotal() {
    return subtotal;
  }

  public void setSubtotal(BigDecimal subtotal) {
    this.subtotal = subtotal;
  }

  public String getReservationId() {
    return reservationId;
  }

  public void setReservationId(String reservationId) {
    this.reservationId = reservationId;
  }
}
