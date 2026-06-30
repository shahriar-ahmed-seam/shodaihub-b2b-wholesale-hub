package com.b2bwholesalehub.inventory.common;

import org.springframework.http.HttpStatus;

/** Raised when a referenced resource (product, supplier, tier) does not exist. */
public class NotFoundException extends ApiException {
  public NotFoundException(String message) {
    super(ErrorCode.NOT_FOUND, HttpStatus.NOT_FOUND, message);
  }
}
