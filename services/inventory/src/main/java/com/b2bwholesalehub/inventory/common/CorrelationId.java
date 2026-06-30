package com.b2bwholesalehub.inventory.common;

import org.slf4j.MDC;

/** Accessor for the current request's correlation id (set by {@link CorrelationIdFilter}). */
public final class CorrelationId {

  private CorrelationId() {}

  public static String current() {
    String value = MDC.get(CorrelationIdFilter.MDC_KEY);
    return value == null ? "" : value;
  }
}
