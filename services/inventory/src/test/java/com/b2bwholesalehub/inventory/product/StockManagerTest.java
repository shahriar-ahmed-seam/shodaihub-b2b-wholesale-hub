package com.b2bwholesalehub.inventory.product;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.b2bwholesalehub.inventory.common.ApiException;
import com.b2bwholesalehub.inventory.common.ErrorCode;
import org.junit.jupiter.api.Test;

/** Example-based tests for stock management. (Req 6.1, 6.2, 6.3) */
class StockManagerTest {

  @Test
  void negativeStockRejected() {
    assertThatThrownBy(() -> StockManager.applyStockChange(ProductStatus.PUBLISHED, -1))
        .isInstanceOf(ApiException.class)
        .satisfies(
            ex ->
                assertThat(((ApiException) ex).code()).isEqualTo(ErrorCode.STOCK_VALIDATION_ERROR));
  }

  @Test
  void publishedDepletedToZeroBecomesOutOfStockAndEmits() {
    StockManager.StockChangeResult result =
        StockManager.applyStockChange(ProductStatus.PUBLISHED, 0);
    assertThat(result.status()).isEqualTo(ProductStatus.OUT_OF_STOCK);
    assertThat(result.indexEventEmitted()).isTrue();
  }

  @Test
  void restockingOutOfStockRepublishesAndEmits() {
    StockManager.StockChangeResult result =
        StockManager.applyStockChange(ProductStatus.OUT_OF_STOCK, 25);
    assertThat(result.status()).isEqualTo(ProductStatus.PUBLISHED);
    assertThat(result.indexEventEmitted()).isTrue();
  }

  @Test
  void positiveStockOnPublishedKeepsStatusAndDoesNotEmit() {
    StockManager.StockChangeResult result =
        StockManager.applyStockChange(ProductStatus.PUBLISHED, 25);
    assertThat(result.status()).isEqualTo(ProductStatus.PUBLISHED);
    assertThat(result.indexEventEmitted()).isFalse();
  }
}
