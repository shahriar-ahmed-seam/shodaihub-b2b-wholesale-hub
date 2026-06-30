package com.b2bwholesalehub.inventory.cart;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartRepository extends JpaRepository<CartEntity, UUID> {

  Optional<CartEntity> findByRetailerId(UUID retailerId);
}
