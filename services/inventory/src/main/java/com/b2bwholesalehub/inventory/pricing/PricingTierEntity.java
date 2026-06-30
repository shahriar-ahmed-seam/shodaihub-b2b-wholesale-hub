package com.b2bwholesalehub.inventory.pricing;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Persistent pricing tier. The pure {@link TierRange} value object carries the same data for the
 * overlap/resolution algorithms; this entity is its database projection. Money is {@code
 * NUMERIC(12,2)}. (Req 5)
 */
@Entity
@Table(name = "pricing_tier")
public class PricingTierEntity {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "product_id", nullable = false)
  private UUID productId;

  @Column(name = "min_qty", nullable = false)
  private int minQty;

  @Column(name = "max_qty", nullable = false)
  private int maxQty;

  @Column(name = "unit_price", nullable = false, precision = 12, scale = 2)
  private BigDecimal unitPrice;

  protected PricingTierEntity() {}

  public PricingTierEntity(UUID id, UUID productId, int minQty, int maxQty, BigDecimal unitPrice) {
    this.id = id;
    this.productId = productId;
    this.minQty = minQty;
    this.maxQty = maxQty;
    this.unitPrice = unitPrice;
  }

  public TierRange toRange() {
    return new TierRange(minQty, maxQty, unitPrice);
  }

  public UUID getId() {
    return id;
  }

  public UUID getProductId() {
    return productId;
  }

  public int getMinQty() {
    return minQty;
  }

  public int getMaxQty() {
    return maxQty;
  }

  public BigDecimal getUnitPrice() {
    return unitPrice;
  }
}
