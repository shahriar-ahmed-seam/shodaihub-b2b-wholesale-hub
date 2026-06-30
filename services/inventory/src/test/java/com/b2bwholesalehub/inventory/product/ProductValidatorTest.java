package com.b2bwholesalehub.inventory.product;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.common.FieldIssue;
import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** Example-based tests for product-creation validation. (Req 4.1, 4.2, 4.3) */
class ProductValidatorTest {

  @Test
  void validDraftHasNoIssues() {
    ProductDraft draft = new ProductDraft("Rice", new BigDecimal("100.00"), 10, "Grains", 2);
    assertThat(ProductValidator.validate(draft)).isEmpty();
    assertThat(ProductValidator.isValid(draft)).isTrue();
  }

  @Test
  void missingRequiredFieldsAreAllReported() {
    ProductDraft draft = new ProductDraft(null, null, null, "  ", 1);
    List<String> fields =
        ProductValidator.validate(draft).stream()
            .map(FieldIssue::field)
            .collect(Collectors.toList());
    assertThat(fields)
        .containsExactlyInAnyOrder(
            ProductValidator.NAME,
            ProductValidator.BASE_PRICE,
            ProductValidator.MOQ,
            ProductValidator.CATEGORY);
  }

  @Test
  void zeroOrNegativeBasePriceIsRejected() {
    ProductDraft zero = new ProductDraft("Rice", BigDecimal.ZERO, 10, "Grains", 1);
    assertThat(ProductValidator.validate(zero))
        .extracting(FieldIssue::field)
        .containsExactly(ProductValidator.BASE_PRICE);

    ProductDraft negative = new ProductDraft("Rice", new BigDecimal("-1.00"), 10, "Grains", 1);
    assertThat(ProductValidator.validate(negative))
        .extracting(FieldIssue::field)
        .containsExactly(ProductValidator.BASE_PRICE);
  }

  @Test
  void missingImageIsRejected() {
    ProductDraft draft = new ProductDraft("Rice", new BigDecimal("100.00"), 10, "Grains", 0);
    assertThat(ProductValidator.validate(draft))
        .extracting(FieldIssue::field)
        .containsExactly(ProductValidator.IMAGES);
  }
}
