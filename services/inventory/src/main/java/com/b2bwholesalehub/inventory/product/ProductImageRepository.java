package com.b2bwholesalehub.inventory.product;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProductImageRepository extends JpaRepository<ProductImage, UUID> {

  List<ProductImage> findByProductIdOrderBySortOrderAsc(UUID productId);
}
