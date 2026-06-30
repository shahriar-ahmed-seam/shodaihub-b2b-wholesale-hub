package com.b2bwholesalehub.inventory.order;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SubOrderRepository extends JpaRepository<SubOrder, UUID> {

  List<SubOrder> findByOrderIdOrderBySupplierIdAsc(UUID orderId);

  boolean existsByRetailerIdAndStatus(UUID retailerId, OrderStatus status);
}
