package com.b2bwholesalehub.inventory.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** A catalog product owned by a single supplier. Money is {@code NUMERIC(12,2)}. (Req 4, 5, 6) */
@Entity
@Table(name = "product")
public class Product {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "supplier_id", nullable = false)
  private UUID supplierId;

  @Column(nullable = false)
  private String name;

  @Column(columnDefinition = "text")
  private String description;

  @Column(nullable = false)
  private String category;

  @Column(name = "base_price", nullable = false, precision = 12, scale = 2)
  private BigDecimal basePrice;

  @Column(nullable = false)
  private int moq;

  @Column(name = "available_stock", nullable = false)
  private int availableStock;

  @Enumerated(EnumType.STRING)
  @Column(nullable = false)
  private ProductStatus status = ProductStatus.DRAFT;

  @Column(name = "avg_rating", precision = 3, scale = 2)
  private BigDecimal avgRating;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt = Instant.now();

  protected Product() {}

  public UUID getId() {
    return id;
  }

  public void setId(UUID id) {
    this.id = id;
  }

  public UUID getSupplierId() {
    return supplierId;
  }

  public void setSupplierId(UUID supplierId) {
    this.supplierId = supplierId;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public String getDescription() {
    return description;
  }

  public void setDescription(String description) {
    this.description = description;
  }

  public String getCategory() {
    return category;
  }

  public void setCategory(String category) {
    this.category = category;
  }

  public BigDecimal getBasePrice() {
    return basePrice;
  }

  public void setBasePrice(BigDecimal basePrice) {
    this.basePrice = basePrice;
  }

  public int getMoq() {
    return moq;
  }

  public void setMoq(int moq) {
    this.moq = moq;
  }

  public int getAvailableStock() {
    return availableStock;
  }

  public void setAvailableStock(int availableStock) {
    this.availableStock = availableStock;
  }

  public ProductStatus getStatus() {
    return status;
  }

  public void setStatus(ProductStatus status) {
    this.status = status;
  }

  public BigDecimal getAvgRating() {
    return avgRating;
  }

  public void setAvgRating(BigDecimal avgRating) {
    this.avgRating = avgRating;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public void setUpdatedAt(Instant updatedAt) {
    this.updatedAt = updatedAt;
  }
}
