package com.b2bwholesalehub.inventory.common;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Money helpers for BDT amounts. Every monetary value in the platform is a fixed-point decimal with
 * exactly 2 fractional digits, stored as {@code NUMERIC(12,2)} and computed with {@link
 * RoundingMode#HALF_UP}. No floating-point types are used for money. (Req 5.8, 17.3)
 */
public final class Money {

  /** Scale (number of decimal places) for all BDT amounts. */
  public static final int SCALE = 2;

  /** Rounding mode applied to every money computation. */
  public static final RoundingMode ROUNDING = RoundingMode.HALF_UP;

  /** Minimum allowed per-unit tier price, inclusive. (Req 5.5) */
  public static final BigDecimal MIN_TIER_PRICE = new BigDecimal("0.01");

  /** Maximum allowed per-unit tier price, inclusive. (Req 5.5) */
  public static final BigDecimal MAX_TIER_PRICE = new BigDecimal("999999.99");

  private Money() {}

  /** Normalizes an amount to exactly 2 decimal places using HALF_UP. */
  public static BigDecimal scaled(BigDecimal amount) {
    return amount.setScale(SCALE, ROUNDING);
  }

  /**
   * Computes a line subtotal as {@code unitPrice * quantity}, rounded half-up to 2 decimals. (Req
   * 5.8)
   */
  public static BigDecimal lineSubtotal(BigDecimal unitPrice, int quantity) {
    return unitPrice.multiply(BigDecimal.valueOf(quantity)).setScale(SCALE, ROUNDING);
  }

  /** True when the amount has at most 2 decimal places. (Req 5.5) */
  public static boolean hasAtMostTwoDecimals(BigDecimal amount) {
    return amount.stripTrailingZeros().scale() <= SCALE;
  }
}
