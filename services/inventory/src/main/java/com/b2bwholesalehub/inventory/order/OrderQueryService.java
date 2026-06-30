package com.b2bwholesalehub.inventory.order;

import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Order retrieval and tracking for retailers: a single order with its sub-orders grouped by
 * supplier (tracking reference shown when shipped, latest status-change timestamp displayed) and a
 * paginated order history. (Req 13.1–13.4)
 */
@Service
public class OrderQueryService {

  private final OrderRepository orderRepository;
  private final SubOrderRepository subOrderRepository;
  private final OrderLineRepository orderLineRepository;
  private final StatusHistoryRepository statusHistoryRepository;

  public OrderQueryService(
      OrderRepository orderRepository,
      SubOrderRepository subOrderRepository,
      OrderLineRepository orderLineRepository,
      StatusHistoryRepository statusHistoryRepository) {
    this.orderRepository = orderRepository;
    this.subOrderRepository = subOrderRepository;
    this.orderLineRepository = orderLineRepository;
    this.statusHistoryRepository = statusHistoryRepository;
  }

  /**
   * Returns one order owned by the retailer, with sub-orders grouped by supplier. (Req 13.1–13.3)
   */
  @Transactional(readOnly = true)
  public OrderView getOrder(UUID retailerId, UUID orderId) {
    OrderEntity order =
        orderRepository
            .findById(orderId)
            .orElseThrow(() -> new NotFoundException("Order not found: " + orderId));
    if (!order.getRetailerId().equals(retailerId)) {
      throw new ForbiddenException("You do not own this order.");
    }

    Map<UUID, List<OrderView.SubOrderView>> bySupplier = new LinkedHashMap<>();
    for (SubOrder sub : subOrderRepository.findByOrderIdOrderBySupplierIdAsc(orderId)) {
      Instant latest =
          StatusTimeline.latestChangeOf(statusHistoryRepository.findBySubOrderId(sub.getId()))
              .orElse(sub.getStatusChangedAt());
      String tracking = sub.getStatus() == OrderStatus.SHIPPED ? sub.getTrackingReference() : null;
      List<OrderView.LineView> lines =
          orderLineRepository.findBySubOrderId(sub.getId()).stream()
              .map(
                  l ->
                      new OrderView.LineView(
                          l.getProductId(), l.getQuantity(), l.getUnitPrice(), l.getLineSubtotal()))
              .toList();
      bySupplier
          .computeIfAbsent(sub.getSupplierId(), k -> new ArrayList<>())
          .add(new OrderView.SubOrderView(sub.getId(), sub.getStatus(), tracking, latest, lines));
    }

    List<OrderView.SupplierGroup> groups = new ArrayList<>();
    bySupplier.forEach(
        (supplierId, subs) -> groups.add(new OrderView.SupplierGroup(supplierId, subs)));
    return new OrderView(order.getId(), order.getOrderTotal(), order.getCreatedAt(), groups);
  }

  /** Paginated order history for a retailer, newest first. (Req 13.4) */
  @Transactional(readOnly = true)
  public Page<OrderEntity> history(UUID retailerId, Pageable pageable) {
    return orderRepository.findByRetailerIdOrderByCreatedAtDesc(retailerId, pageable);
  }
}
