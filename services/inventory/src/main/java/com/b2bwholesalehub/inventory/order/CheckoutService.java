package com.b2bwholesalehub.inventory.order;

import com.b2bwholesalehub.inventory.cart.CartItem;
import com.b2bwholesalehub.inventory.cart.CartItemRepository;
import com.b2bwholesalehub.inventory.cart.CartRepository;
import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import com.b2bwholesalehub.inventory.reservation.ReservationService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Checkout and order splitting (Deep-Dive 3). The whole operation runs in one DB transaction so an
 * expired reservation aborts with no orphan sub-orders: the cart is verified, split into one
 * sub-order per supplier under a single parent order, and persisted atomically. Reservations are
 * NOT released — they persist (PENDING) until payment converts them or they expire. (Req 10.1–10.7)
 */
@Service
public class CheckoutService {

  private final CartRepository cartRepository;
  private final CartItemRepository cartItemRepository;
  private final OrderRepository orderRepository;
  private final SubOrderRepository subOrderRepository;
  private final OrderLineRepository orderLineRepository;
  private final StatusHistoryRepository statusHistoryRepository;
  private final ReservationService reservationService;

  public CheckoutService(
      CartRepository cartRepository,
      CartItemRepository cartItemRepository,
      OrderRepository orderRepository,
      SubOrderRepository subOrderRepository,
      OrderLineRepository orderLineRepository,
      StatusHistoryRepository statusHistoryRepository,
      ReservationService reservationService) {
    this.cartRepository = cartRepository;
    this.cartItemRepository = cartItemRepository;
    this.orderRepository = orderRepository;
    this.subOrderRepository = subOrderRepository;
    this.orderLineRepository = orderLineRepository;
    this.statusHistoryRepository = statusHistoryRepository;
    this.reservationService = reservationService;
  }

  @Transactional
  public CheckoutResponse checkout(UUID retailerId) {
    UUID cartId =
        cartRepository
            .findByRetailerId(retailerId)
            .map(com.b2bwholesalehub.inventory.cart.CartEntity::getId)
            .orElse(null);
    List<CartItem> items =
        cartId == null
            ? List.of()
            : cartItemRepository.findByCartIdOrderBySupplierIdAscIdAsc(cartId);

    if (items.isEmpty()) {
      throw new ApiException(
          ErrorCode.EMPTY_CART, HttpStatus.CONFLICT, "Cannot check out an empty cart.");
    }

    List<CheckoutLine> lines =
        items.stream()
            .map(
                i ->
                    new CheckoutLine(
                        i.getId(),
                        i.getProductId(),
                        i.getSupplierId(),
                        i.getQuantity(),
                        i.getResolvedUnitPrice(),
                        i.getSubtotal(),
                        i.getReservationId()))
            .toList();

    // Verify every reservation is still active before splitting; halt with no side effects when
    // any has expired (Req 10.4). The check and persistence share this transaction.
    CheckoutPlanner.Outcome outcome =
        CheckoutPlanner.plan(
            retailerId,
            lines,
            line ->
                line.reservationId() != null && reservationService.isActive(line.reservationId()));

    if (outcome.halted()) {
      List<FieldIssue> affected =
          outcome.affected().stream()
              .map(
                  line ->
                      new FieldIssue(
                          "cartItemId:" + line.cartItemId(),
                          "reservation expired for product " + line.productId()))
              .toList();
      throw new ApiException(
          ErrorCode.RESERVATION_EXPIRED,
          HttpStatus.CONFLICT,
          "Checkout halted: one or more reservations have expired.",
          affected);
    }

    return persist(outcome.plan(), cartId);
  }

  private CheckoutResponse persist(OrderPlan plan, UUID cartId) {
    Instant now = Instant.now();
    OrderEntity order =
        orderRepository.save(
            new OrderEntity(UUID.randomUUID(), plan.retailerId(), plan.orderTotal(), now));

    List<CheckoutResponse.SubOrderStatus> statuses = new ArrayList<>();
    for (OrderPlan.SubOrderPlan sub : plan.subOrders()) {
      SubOrder subOrder =
          subOrderRepository.save(
              new SubOrder(
                  UUID.randomUUID(),
                  order.getId(),
                  sub.supplierId(),
                  sub.retailerId(),
                  sub.total(),
                  OrderStatus.PENDING,
                  now));
      for (CheckoutLine line : sub.lines()) {
        orderLineRepository.save(
            new OrderLine(
                UUID.randomUUID(),
                subOrder.getId(),
                line.productId(),
                line.quantity(),
                line.unitPrice(),
                line.lineSubtotal(),
                line.reservationId()));
      }
      statusHistoryRepository.save(
          new StatusHistory(UUID.randomUUID(), subOrder.getId(), OrderStatus.PENDING, now));
      statuses.add(
          new CheckoutResponse.SubOrderStatus(
              subOrder.getId(), subOrder.getSupplierId(), subOrder.getStatus()));
    }

    // The cart's lines have become an order; their reservations persist until payment or expiry.
    cartItemRepository.deleteByCartId(cartId);
    return new CheckoutResponse(order.getId(), statuses);
  }
}
