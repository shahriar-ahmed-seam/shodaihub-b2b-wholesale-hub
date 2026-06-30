package com.b2bwholesalehub.inventory.fulfillment;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import com.b2bwholesalehub.inventory.common.FieldIssue;
import com.b2bwholesalehub.inventory.common.ForbiddenException;
import com.b2bwholesalehub.inventory.common.NotFoundException;
import com.b2bwholesalehub.inventory.order.OrderLine;
import com.b2bwholesalehub.inventory.order.OrderLineRepository;
import com.b2bwholesalehub.inventory.order.OrderStatus;
import com.b2bwholesalehub.inventory.order.StatusHistory;
import com.b2bwholesalehub.inventory.order.StatusHistoryRepository;
import com.b2bwholesalehub.inventory.order.SubOrder;
import com.b2bwholesalehub.inventory.order.SubOrderRepository;
import com.b2bwholesalehub.inventory.product.Product;
import com.b2bwholesalehub.inventory.product.ProductRepository;
import com.b2bwholesalehub.inventory.reservation.ReservationService;
import com.b2bwholesalehub.inventory.supplier.SupplierProfile;
import com.b2bwholesalehub.inventory.supplier.SupplierProfileRepository;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Sub-order fulfillment: the CONFIRMED → PACKED → SHIPPED → DELIVERED state machine plus
 * cancellation with stock restoration. Every transition is validated against {@link
 * FulfillmentStateMachine}, records a status-history row, and updates the sub-order's
 * status-changed timestamp. (Req 12.1–12.5)
 */
@Service
public class FulfillmentService {

  private final SubOrderRepository subOrderRepository;
  private final OrderLineRepository orderLineRepository;
  private final StatusHistoryRepository statusHistoryRepository;
  private final ProductRepository productRepository;
  private final SupplierProfileRepository supplierRepository;
  private final ReservationService reservationService;

  public FulfillmentService(
      SubOrderRepository subOrderRepository,
      OrderLineRepository orderLineRepository,
      StatusHistoryRepository statusHistoryRepository,
      ProductRepository productRepository,
      SupplierProfileRepository supplierRepository,
      ReservationService reservationService) {
    this.subOrderRepository = subOrderRepository;
    this.orderLineRepository = orderLineRepository;
    this.statusHistoryRepository = statusHistoryRepository;
    this.productRepository = productRepository;
    this.supplierRepository = supplierRepository;
    this.reservationService = reservationService;
  }

  /** CONFIRMED → PACKED by the owning supplier. (Req 12.1) */
  @Transactional
  public SubOrder pack(UUID userId, UUID subOrderId) {
    SubOrder sub = requireSupplierOwned(userId, subOrderId);
    return transition(sub, OrderStatus.PACKED, null);
  }

  /** PACKED → SHIPPED by the owning supplier, storing the tracking reference. (Req 12.2) */
  @Transactional
  public SubOrder ship(UUID userId, UUID subOrderId, String trackingReference) {
    if (trackingReference == null || trackingReference.isBlank()) {
      throw new ApiException(
          ErrorCode.VALIDATION_ERROR,
          HttpStatus.BAD_REQUEST,
          "A tracking reference is required to ship a sub-order.",
          List.of(new FieldIssue("trackingReference", "must not be blank")));
    }
    SubOrder sub = requireSupplierOwned(userId, subOrderId);
    return transition(sub, OrderStatus.SHIPPED, trackingReference);
  }

  /** SHIPPED → DELIVERED by the owning supplier (or logistics). (Req 12.3) */
  @Transactional
  public SubOrder deliver(UUID userId, UUID subOrderId) {
    SubOrder sub = requireSupplierOwned(userId, subOrderId);
    return transition(sub, OrderStatus.DELIVERED, null);
  }

  /**
   * Cancels a PENDING or CONFIRMED sub-order by an authorized user and restores its units to
   * available stock. (Req 12.5)
   */
  @Transactional
  public SubOrder cancel(UUID userId, UUID subOrderId) {
    SubOrder sub = requireAuthorizedForCancel(userId, subOrderId);
    OrderStatus previous = sub.getStatus();
    transition(sub, OrderStatus.CANCELLED, null);
    restoreStock(previous, subOrderId);
    return sub;
  }

  // --- internals ---

  private SubOrder transition(SubOrder sub, OrderStatus to, String trackingReference) {
    FulfillmentStateMachine.validate(sub.getStatus(), to);
    Instant now = Instant.now();
    sub.setStatus(to);
    sub.setStatusChangedAt(now);
    if (to == OrderStatus.SHIPPED && trackingReference != null) {
      sub.setTrackingReference(trackingReference);
    }
    subOrderRepository.save(sub);
    statusHistoryRepository.save(new StatusHistory(UUID.randomUUID(), sub.getId(), to, now));
    return sub;
  }

  private void restoreStock(OrderStatus previous, UUID subOrderId) {
    List<OrderLine> lines = orderLineRepository.findBySubOrderId(subOrderId);
    if (CancellationStock.releasesReservations(previous)) {
      // PENDING: reservations still hold the units; releasing returns them to sellable.
      for (OrderLine line : lines) {
        if (line.getReservationId() != null) {
          reservationService.release(line.getReservationId());
        }
      }
    } else if (previous == OrderStatus.CONFIRMED) {
      // CONFIRMED: units were permanently decremented; add them back to persistent stock.
      for (OrderLine line : lines) {
        Product product =
            productRepository
                .findByIdForUpdate(line.getProductId())
                .orElseThrow(
                    () -> new NotFoundException("Product not found: " + line.getProductId()));
        int restored =
            CancellationStock.restoredPersistentStock(
                OrderStatus.CONFIRMED, product.getAvailableStock(), line.getQuantity());
        product.setAvailableStock(restored);
        product.setUpdatedAt(Instant.now());
        productRepository.save(product);
        reservationService.syncStockMirror(product.getId(), restored);
      }
    }
  }

  private SubOrder requireSupplierOwned(UUID userId, UUID subOrderId) {
    SubOrder sub = requireSubOrder(subOrderId);
    Optional<SupplierProfile> supplier = supplierRepository.findByUserId(userId);
    if (supplier.isEmpty() || !supplier.get().getId().equals(sub.getSupplierId())) {
      throw new ForbiddenException("You do not own this sub-order.");
    }
    return sub;
  }

  private SubOrder requireAuthorizedForCancel(UUID userId, UUID subOrderId) {
    SubOrder sub = requireSubOrder(subOrderId);
    boolean isRetailerOwner = sub.getRetailerId().equals(userId);
    boolean isSupplierOwner =
        supplierRepository
            .findByUserId(userId)
            .map(s -> s.getId().equals(sub.getSupplierId()))
            .orElse(false);
    if (!isRetailerOwner && !isSupplierOwner) {
      throw new ForbiddenException("You are not authorized to cancel this sub-order.");
    }
    return sub;
  }

  private SubOrder requireSubOrder(UUID subOrderId) {
    return subOrderRepository
        .findById(subOrderId)
        .orElseThrow(() -> new NotFoundException("Sub-order not found: " + subOrderId));
  }
}
