package com.b2bwholesalehub.inventory.product;

import static org.assertj.core.api.Assertions.assertThat;

import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 8: Out-of-stock transition triggers on depletion — for any
 * product whose available stock transitions to zero, the product status becomes OUT_OF_STOCK and a
 * search-index update event is emitted.
 *
 * <p>**Validates: Requirements 6.3**
 */
class OutOfStockPropertyTest {

  @Property(tries = 200)
  void stockChangeProducesExpectedStatusAndEvent(
      @ForAll ProductStatus current, @ForAll @IntRange(min = 0, max = 1_000_000) int newStock) {

    StockManager.StockChangeResult result = StockManager.applyStockChange(current, newStock);

    assertThat(result.stock()).isEqualTo(newStock);

    ProductStatus expectedStatus;
    if (newStock == 0) {
      expectedStatus =
          (current == ProductStatus.PUBLISHED || current == ProductStatus.OUT_OF_STOCK)
              ? ProductStatus.OUT_OF_STOCK
              : current;
    } else {
      expectedStatus = (current == ProductStatus.OUT_OF_STOCK) ? ProductStatus.PUBLISHED : current;
    }
    assertThat(result.status()).isEqualTo(expectedStatus);
    assertThat(result.indexEventEmitted()).isEqualTo(expectedStatus != current);

    // Core Property 8 claim: an in-catalog product depleted to zero goes OUT_OF_STOCK and emits.
    if (current == ProductStatus.PUBLISHED && newStock == 0) {
      assertThat(result.status()).isEqualTo(ProductStatus.OUT_OF_STOCK);
      assertThat(result.indexEventEmitted()).isTrue();
    }
  }
}
