package com.b2bwholesalehub.inventory.reservation;

/**
 * Outcome of a reservation -> permanent decrement conversion (Req 6.5, 7.7, 11.9).
 *
 * @param converted whether the conversion succeeded
 * @param value on success, the new stock mirror value after the permanent decrement; on failure
 *     (expired reservation with insufficient sellable stock), the current sellable quantity
 */
public record ConvertResult(boolean converted, long value) {}
