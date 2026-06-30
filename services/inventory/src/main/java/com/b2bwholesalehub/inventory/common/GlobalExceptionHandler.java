package com.b2bwholesalehub.inventory.common;

import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Maps every exception onto the platform's shared error envelope:
 *
 * <pre>{ "error": { "code", "message", "details", "correlationId" } }</pre>
 *
 * so the BFF and frontend handle errors uniformly across services.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  public ResponseEntity<Map<String, Object>> handleApi(ApiException ex) {
    return envelope(ex.status(), ex.code(), ex.getMessage(), ex.details());
  }

  @ExceptionHandler(MissingRequestHeaderException.class)
  public ResponseEntity<Map<String, Object>> handleMissingHeader(MissingRequestHeaderException ex) {
    return envelope(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        "Missing required header: " + ex.getHeaderName(),
        List.of(new FieldIssue(ex.getHeaderName(), "required")));
  }

  @ExceptionHandler(Exception.class)
  public ResponseEntity<Map<String, Object>> handleUnexpected(Exception ex) {
    log.error("Unhandled exception", ex);
    return envelope(
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.INTERNAL_ERROR,
        "An unexpected error occurred.",
        List.of());
  }

  private ResponseEntity<Map<String, Object>> envelope(
      HttpStatus status, ErrorCode code, String message, List<FieldIssue> details) {
    Map<String, Object> error =
        Map.of(
            "code",
            code.name(),
            "message",
            message == null ? "" : message,
            "details",
            details,
            "correlationId",
            CorrelationId.current());
    return ResponseEntity.status(status).body(Map.of("error", error));
  }
}
