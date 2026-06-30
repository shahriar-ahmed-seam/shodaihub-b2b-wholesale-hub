package com.b2bwholesalehub.inventory.review;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ReviewRepository extends JpaRepository<Review, UUID> {

  boolean existsByProductIdAndRetailerId(UUID productId, UUID retailerId);

  List<Review> findByProductIdAndHiddenFalse(UUID productId);
}
