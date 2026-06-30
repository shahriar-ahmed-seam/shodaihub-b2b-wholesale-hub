package com.b2bwholesalehub.inventory.order;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderLineRepository extends JpaRepository<OrderLine, UUID> {

  List<OrderLine> findBySubOrderId(UUID subOrderId);

  /**
   * Distinct product ids the retailer has a DELIVERED sub-order for — drives review eligibility.
   * (Req 15.1)
   */
  @org.springframework.data.jpa.repository.Query(
      "select distinct l.productId from OrderLine l, SubOrder s "
          + "where l.subOrderId = s.id and s.retailerId = :retailerId and s.status = :status")
  List<UUID> findProductIdsByRetailerAndSubOrderStatus(
      @org.springframework.data.repository.query.Param("retailerId") UUID retailerId,
      @org.springframework.data.repository.query.Param("status") OrderStatus status);
}
