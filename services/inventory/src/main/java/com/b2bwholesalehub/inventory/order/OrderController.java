package com.b2bwholesalehub.inventory.order;

import com.b2bwholesalehub.inventory.common.Identity;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Checkout, order retrieval, and order history endpoints for retailers. (Req 10, 13) */
@RestController
public class OrderController {

  private final CheckoutService checkoutService;
  private final OrderQueryService orderQueryService;

  public OrderController(CheckoutService checkoutService, OrderQueryService orderQueryService) {
    this.checkoutService = checkoutService;
    this.orderQueryService = orderQueryService;
  }

  @PostMapping("/checkout")
  public ResponseEntity<CheckoutResponse> checkout(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId) {
    return ResponseEntity.ok(checkoutService.checkout(retailerId));
  }

  @GetMapping("/orders/{id}")
  public ResponseEntity<OrderView> getOrder(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId, @PathVariable UUID id) {
    return ResponseEntity.ok(orderQueryService.getOrder(retailerId, id));
  }

  @GetMapping("/orders")
  public ResponseEntity<Page<OrderEntity>> history(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    int clamped = Math.min(Math.max(size, 1), 100);
    return ResponseEntity.ok(
        orderQueryService.history(retailerId, PageRequest.of(Math.max(page, 0), clamped)));
  }
}
