package com.b2bwholesalehub.inventory.common;

import java.util.List;
import org.springframework.http.HttpStatus;

/**
 * Base exception for all business/validation failures. Carries the machine-readable error code, the
 * HTTP status to return, and an optional list of field-level details. The {@link
 * GlobalExceptionHandler} maps it onto the shared error envelope {@code {error:{code, message,
 * details, correlationId}}}.
 */
public class ApiException extends RuntimeException {

  private final ErrorCode code;
  private final HttpStatus status;
  private final transient List<FieldIssue> details;

  public ApiException(ErrorCode code, HttpStatus status, String message) {
    this(code, status, message, List.of());
  }

  public ApiException(ErrorCode code, HttpStatus status, String message, List<FieldIssue> details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details == null ? List.of() : List.copyOf(details);
  }

  public ErrorCode code() {
    return code;
  }

  public HttpStatus status() {
    return status;
  }

  public List<FieldIssue> details() {
    return details;
  }
}
