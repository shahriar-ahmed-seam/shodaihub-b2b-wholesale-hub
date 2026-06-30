package com.b2bwholesalehub.inventory.cart;

import com.b2bwholesalehub.inventory.common.Identity;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Retailer shopping-cart endpoints. (Req 9, 7.1, 7.6) */
@RestController
public class CartController {

  /** Add-to-cart payload. */
  public record AddItemRequest(UUID productId, int quantity) {}

  /** Quantity-change payload. */
  public record ChangeQuantityRequest(int quantity) {}

  private final CartService cartService;

  public CartController(CartService cartService) {
    this.cartService = cartService;
  }

  @PostMapping("/cart/items")
  public ResponseEntity<CartItem> addItem(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId,
      @RequestBody AddItemRequest request) {
    CartItem item = cartService.addItem(retailerId, request.productId(), request.quantity());
    return ResponseEntity.status(HttpStatus.CREATED).body(item);
  }

  @PutMapping("/cart/items/{id}")
  public ResponseEntity<CartItem> changeQuantity(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId,
      @PathVariable UUID id,
      @RequestBody ChangeQuantityRequest request) {
    return ResponseEntity.ok(cartService.changeQuantity(retailerId, id, request.quantity()));
  }

  @DeleteMapping("/cart/items/{id}")
  public ResponseEntity<Void> removeItem(
      @RequestHeader(Identity.USER_ID_HEADER) UUID retailerId, @PathVariable UUID id) {
    cartService.removeItem(retailerId, id);
    return ResponseEntity.noContent().build();
  }

  @GetMapping("/cart")
  public ResponseEntity<GroupedCart> view(@RequestHeader(Identity.USER_ID_HEADER) UUID retailerId) {
    return ResponseEntity.ok(cartService.view(retailerId));
  }
}
