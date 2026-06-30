package com.b2bwholesalehub.inventory.fulfillment;

import com.b2bwholesalehub.inventory.common.Identity;
import com.b2bwholesalehub.inventory.order.SubOrder;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

/** Sub-order fulfillment endpoints: pack, ship, deliver, cancel. (Req 12) */
@RestController
public class FulfillmentController {

  /** Ship payload carrying the required tracking reference. */
  public record ShipRequest(String trackingReference) {}

  private final FulfillmentService fulfillmentService;

  public FulfillmentController(FulfillmentService fulfillmentService) {
    this.fulfillmentService = fulfillmentService;
  }

  @PostMapping("/suborders/{id}/pack")
  public ResponseEntity<SubOrder> pack(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(fulfillmentService.pack(userId, id));
  }

  @PostMapping("/suborders/{id}/ship")
  public ResponseEntity<SubOrder> ship(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId,
      @PathVariable UUID id,
      @RequestBody ShipRequest request) {
    return ResponseEntity.ok(fulfillmentService.ship(userId, id, request.trackingReference()));
  }

  @PostMapping("/suborders/{id}/deliver")
  public ResponseEntity<SubOrder> deliver(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(fulfillmentService.deliver(userId, id));
  }

  @PostMapping("/suborders/{id}/cancel")
  public ResponseEntity<SubOrder> cancel(
      @RequestHeader(Identity.USER_ID_HEADER) UUID userId, @PathVariable UUID id) {
    return ResponseEntity.ok(fulfillmentService.cancel(userId, id));
  }
}
