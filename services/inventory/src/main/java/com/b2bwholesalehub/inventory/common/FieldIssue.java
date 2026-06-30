package com.b2bwholesalehub.inventory.common;

/**
 * A single field-level problem reported in the {@code details} array of the shared error envelope.
 *
 * @param field the offending field name
 * @param issue a human-readable description of what is wrong
 */
public record FieldIssue(String field, String issue) {}
