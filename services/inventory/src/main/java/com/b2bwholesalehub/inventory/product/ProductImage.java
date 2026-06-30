package com.b2bwholesalehub.inventory.product;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.UUID;

/** An image associated with a product. At least one is required to create a product. (Req 4.1) */
@Entity
@Table(name = "product_image")
public class ProductImage {

  @Id
  @Column(nullable = false)
  private UUID id;

  @Column(name = "product_id", nullable = false)
  private UUID productId;

  @Column(nullable = false)
  private String url;

  @Column(name = "sort_order", nullable = false)
  private int sortOrder;

  protected ProductImage() {}

  public ProductImage(UUID id, UUID productId, String url, int sortOrder) {
    this.id = id;
    this.productId = productId;
    this.url = url;
    this.sortOrder = sortOrder;
  }

  public UUID getId() {
    return id;
  }

  public UUID getProductId() {
    return productId;
  }

  public String getUrl() {
    return url;
  }

  public int getSortOrder() {
    return sortOrder;
  }
}
