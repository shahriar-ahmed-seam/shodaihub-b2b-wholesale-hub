package com.b2bwholesalehub.inventory.product;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ProductRepository extends JpaRepository<Product, UUID> {

  Page<Product> findBySupplierId(UUID supplierId, Pageable pageable);

  /**
   * Pessimistic row lock used to serialize tier edits and stock changes for a product, so
   * concurrent mutations cannot both pass validation. (Design Deep-Dive 1; {@code SELECT ... FOR
   * UPDATE})
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select p from Product p where p.id = :id")
  Optional<Product> findByIdForUpdate(@Param("id") UUID id);
}
