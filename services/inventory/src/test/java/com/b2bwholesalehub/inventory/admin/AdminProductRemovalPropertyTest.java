package com.b2bwholesalehub.inventory.admin;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.event.ProductIndexEvent;
import com.b2bwholesalehub.inventory.product.ProductStatus;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;

/**
 * Feature: b2b-wholesale-hub, Property 39: Admin product removal removes and de-indexes — for any
 * product removed by an administrator, the product status becomes REMOVED and a search-index
 * removal (de-index) event is emitted, regardless of the product's prior status.
 *
 * <p>**Validates: Requirements 16.4**
 */
class AdminProductRemovalPropertyTest {

  @Property(tries = 200)
  void removalAlwaysSetsRemovedAndDeIndexes(@ForAll ProductStatus current) {
    AdminProductRemoval.Result result = AdminProductRemoval.remove(current);
    // Status becomes REMOVED whatever the prior status was.
    assertThat(result.status()).isEqualTo(ProductStatus.REMOVED);
    // A de-index (DELETE) event is required.
    assertThat(result.indexOp()).isEqualTo(ProductIndexEvent.Op.DELETE);
  }
}
