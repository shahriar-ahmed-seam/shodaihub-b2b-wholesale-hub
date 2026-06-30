package com.b2bwholesalehub.inventory.product;

import static org.assertj.core.api.Assertions.assertThat;

import com.b2bwholesalehub.inventory.common.FieldIssue;
import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;
import org.springframework.util.StringUtils;

/**
 * Feature: b2b-wholesale-hub, Property 10: Product creation validation reports exactly the
 * missing/invalid fields — for any product submission, it is rejected iff a required field among
 * name, base price, MOQ, category is missing or the base price is &le; 0; when rejected the error
 * names exactly the offending fields, otherwise a DRAFT product is created.
 *
 * <p>**Validates: Requirements 4.1, 4.2, 4.3**
 */
class ProductValidatorPropertyTest {

  @Property(tries = 200)
  void reportsExactlyTheOffendingFields(
      @ForAll("names") String name,
      @ForAll("prices") BigDecimal basePrice,
      @ForAll("moqs") Integer moq,
      @ForAll("names") String category,
      @ForAll @IntRange(min = 1, max = 5) int imageCount) {

    ProductDraft draft = new ProductDraft(name, basePrice, moq, category, imageCount);

    // Independently computed set of fields that should be reported (image count is always >= 1, so
    // the only possible offenders are the four Property-10 fields).
    Set<String> expected = new HashSet<>();
    if (!StringUtils.hasText(name)) {
      expected.add(ProductValidator.NAME);
    }
    if (basePrice == null || basePrice.compareTo(BigDecimal.ZERO) <= 0) {
      expected.add(ProductValidator.BASE_PRICE);
    }
    if (moq == null || moq < 1) {
      expected.add(ProductValidator.MOQ);
    }
    if (!StringUtils.hasText(category)) {
      expected.add(ProductValidator.CATEGORY);
    }

    List<FieldIssue> issues = ProductValidator.validate(draft);
    Set<String> reported = issues.stream().map(FieldIssue::field).collect(Collectors.toSet());

    // Reported fields are exactly the offending fields.
    assertThat(reported).isEqualTo(expected);
    // Rejected iff there is at least one offending field.
    assertThat(ProductValidator.isValid(draft)).isEqualTo(expected.isEmpty());
  }

  @Provide
  Arbitrary<String> names() {
    return Arbitraries.of("", "   ", "Basmati Rice", "Cement", "x").injectNull(0.25);
  }

  @Provide
  Arbitrary<BigDecimal> prices() {
    return Arbitraries.of(
            new BigDecimal("-100.00"),
            new BigDecimal("-0.01"),
            BigDecimal.ZERO,
            new BigDecimal("0.01"),
            new BigDecimal("250.00"),
            new BigDecimal("999999.99"))
        .injectNull(0.2);
  }

  @Provide
  Arbitrary<Integer> moqs() {
    return Arbitraries.of(-10, -1, 0, 1, 25, 999999).injectNull(0.2);
  }
}
