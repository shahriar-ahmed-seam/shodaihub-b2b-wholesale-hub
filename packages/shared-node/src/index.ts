/**
 * @b2b/shared-node — cross-cutting conventions for the Node.js services
 * (Auth, BFF, Payment, Notification).
 *
 * Provides:
 *  - the standard error envelope type + helpers ({@link makeError}, {@link AppError});
 *  - the {@link HttpStatus} table and {@link Errors} convention helpers;
 *  - a structured JSON {@link Logger} (timestamp, level, service, correlationId, message, context);
 *  - the {@link correlationId} Express middleware (reads or generates `X-Correlation-Id`).
 *
 * ──────────────────────────────────────────────────────────────────────────────────────────
 * EQUIVALENT CONVENTIONS IN THE OTHER STACKS
 *
 * The same three cross-cutting concerns are implemented natively in the non-Node services so the
 * whole platform produces identical error envelopes, identical structured-log fields, and a
 * correlation id propagated on every hop (design: Error Handling, Observability, Req 20.2).
 *
 * Inventory Service — Java 21 / Spring Boot 3:
 *   • Correlation id: a `OncePerRequestFilter` (servlet filter) reads or generates
 *     `X-Correlation-Id`, puts it on the SLF4J MDC (`MDC.put("correlationId", id)`), echoes it on
 *     the response, and clears the MDC in a `finally` block. A `ClientHttpRequestInterceptor` /
 *     `RestClient` request initializer forwards the header on outbound calls.
 *   • Structured logs: logback configured with `logstash-logback-encoder`
 *     (`LogstashEncoder` / `LoggingEventCompositeJsonEncoder`) to emit JSON with
 *     `timestamp, level, service, correlationId (from MDC), message, context`.
 *   • Error envelope: a `@RestControllerAdvice` `@ExceptionHandler` maps exceptions to the same
 *     `{ error: { code, message, details, correlationId } }` JSON body and HTTP status.
 *
 * Search Service — Python 3.12 / FastAPI:
 *   • Correlation id: an ASGI/HTTP middleware (e.g. `@app.middleware("http")`) reads or generates
 *     `X-Correlation-Id`, binds it via `structlog.contextvars.bind_contextvars`, and sets it on
 *     the response header. An `httpx` event hook forwards the header on outbound calls.
 *   • Structured logs: `structlog` configured with `JSONRenderer` and a timestamper, emitting
 *     `timestamp, level, service, correlationId, message` plus bound context.
 *   • Error envelope: an `@app.exception_handler` returns a `JSONResponse` with the same
 *     `{ "error": { code, message, details, correlationId } }` shape and matching status code.
 * ──────────────────────────────────────────────────────────────────────────────────────────
 */

export {
  AppError,
  makeError,
  type ErrorBody,
  type ErrorDetail,
  type ErrorEnvelope,
} from './errors.js';

export { Errors, HttpStatus, type HttpStatusCode, type HttpStatusName } from './http-status.js';

export {
  Logger,
  createLogger,
  type LogLevel,
  type LogRecord,
  type LoggerOptions,
} from './logger.js';

export {
  CORRELATION_ID_HEADER,
  correlationId,
  getCorrelationId,
  type CorrelatedRequestFields,
  type CorrelationMiddlewareOptions,
} from './correlation.js';
