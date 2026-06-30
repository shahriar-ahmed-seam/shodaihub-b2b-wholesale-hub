package com.b2bwholesalehub.inventory.pricing;

import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Price-resolution endpoint used by retailers to quote a line item. (Req 5.6, 5.7, 5.8) */
@RestController
public class PricingController {

  /** Quote request payload. */
  public record QuoteRequest(UUID productId, int quantity) {}

  private final PricingQuoteService quoteService;

  public PricingController(PricingQuoteService quoteService) {
    this.quoteService = quoteService;
  }

  @PostMapping("/pricing/quote")
  public ResponseEntity<PricingQuoteService.Quote> quote(@RequestBody QuoteRequest request) {
    return ResponseEntity.ok(quoteService.quote(request.productId(), request.quantity()));
  }
}
