package com.b2bwholesalehub.inventory.product;

import java.math.BigDecimal;

/**
 * The raw, unvalidated fields of a product-creation submission. Nullable fields model "missing"
 * input so the validator can report exactly which required fields are absent. (Req 4.1, 4.2, 4.3)
 *
 * @param name product name (required, non-blank)
 * @param basePrice base price in BDT (required, must be &gt; 0)
 * @param moq minimum order quantity (required, positive integer)
 * @param category product category (required, non-blank)
 * @param imageCount number of supplied images (at least one required)
 */
public record ProductDraft(
    String name, BigDecimal basePrice, Integer moq, String category, int imageCount) {}
