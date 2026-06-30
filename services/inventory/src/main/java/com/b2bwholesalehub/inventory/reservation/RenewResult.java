package com.b2bwholesalehub.inventory.reservation;

/**
 * Outcome of a renewal attempt (Req 7.9, 7.10).
 *
 * @param renewed whether the expiry was extended
 * @param renewals the renewal count after the attempt (unchanged when rejected)
 * @param expiresAt the reservation expiry in epoch millis after the attempt (retained when
 *     rejected); {@code -1} when the reservation no longer exists
 */
public record RenewResult(boolean renewed, int renewals, long expiresAt) {}
