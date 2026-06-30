package com.b2bwholesalehub.inventory.common;

import org.springframework.http.HttpStatus;

/**
 * Raised when an authenticated user attempts to modify a resource they do not own. Fine-grained
 * ownership checks live in the Inventory Service. (Req 2.4)
 */
public class ForbiddenException extends ApiException {
  public ForbiddenException(String message) {
    super(ErrorCode.FORBIDDEN, HttpStatus.FORBIDDEN, message);
  }
}
