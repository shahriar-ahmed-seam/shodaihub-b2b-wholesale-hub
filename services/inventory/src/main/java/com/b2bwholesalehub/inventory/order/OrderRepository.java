package com.b2bwholesalehub.inventory.order;

import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<OrderEntity, UUID> {

  Page<OrderEntity> findByRetailerIdOrderByCreatedAtDesc(UUID retailerId, Pageable pageable);

  /**
   * Distinct retailers who have placed at least one order — a within-boundary retailer count. (Req
   * 16.5)
   */
  @org.springframework.data.jpa.repository.Query(
      "select count(distinct o.retailerId) from OrderEntity o")
  long countDistinctRetailers();
}
