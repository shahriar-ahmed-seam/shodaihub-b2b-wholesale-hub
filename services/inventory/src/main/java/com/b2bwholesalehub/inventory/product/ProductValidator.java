package com.b2bwholesalehub.inventory.product;

import com.b2bwholesalehub.inventory.common.FieldIssue;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.util.StringUtils;

/**
 * Pure product-creation validation. Produces the exact set of field issues for a submission so the
 * caller can reject with a validation error that "names exactly the offending fields", or create a
 * DRAFT product when the issue list is empty. No database access. (Req 4.1, 4.2, 4.3)
 */
public final class ProductValidator {

  public static final String NAME = "name";
  public static final String BASE_PRICE = "basePrice";
  public static final String MOQ = "moq";
  public static final String CATEGORY = "category";
  public static final String IMAGES = "images";

  private ProductValidator() {}

  /**
   * Returns the field-level issues for a draft. An empty list means the submission is valid and a
   * DRAFT product may be created.
   */
  public static List<FieldIssue> validate(ProductDraft draft) {
    List<FieldIssue> issues = new ArrayList<>();

    if (!StringUtils.hasText(draft.name())) {
      issues.add(new FieldIssue(NAME, "is required"));
    }
    if (draft.basePrice() == null) {
      issues.add(new FieldIssue(BASE_PRICE, "is required"));
    } else if (draft.basePrice().compareTo(BigDecimal.ZERO) <= 0) {
      issues.add(new FieldIssue(BASE_PRICE, "must be greater than zero"));
    }
    if (draft.moq() == null) {
      issues.add(new FieldIssue(MOQ, "is required"));
    } else if (draft.moq() < 1) {
      issues.add(new FieldIssue(MOQ, "must be a positive integer"));
    }
    if (!StringUtils.hasText(draft.category())) {
      issues.add(new FieldIssue(CATEGORY, "is required"));
    }
    if (draft.imageCount() < 1) {
      issues.add(new FieldIssue(IMAGES, "at least one image is required"));
    }
    return issues;
  }

  /** Convenience: true when the draft passes all validation rules. */
  public static boolean isValid(ProductDraft draft) {
    return validate(draft).isEmpty();
  }
}
