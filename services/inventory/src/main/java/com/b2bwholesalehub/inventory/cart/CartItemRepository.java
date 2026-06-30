package com.b2bwholesalehub.inventory.cart;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

  List<CartItem> findByCartIdOrderBySupplierIdAscIdAsc(UUID cartId);

  void deleteByCartId(UUID cartId);
}
