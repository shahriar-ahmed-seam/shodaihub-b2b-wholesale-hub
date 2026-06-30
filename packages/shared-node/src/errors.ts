/**
 * Standard error envelope shared across all services.
 *
 * Every service (Node, Spring, FastAPI) returns errors in this exact JSON shape so the BFF and
 * frontend can handle them uniformly (design: Error Handling → Standard Error Envelope):
 *
 * ```json
 * {
 *   "error": {
 *     "code": "TIER_OVERLAP",
 *     "message": "The pricing tier overlaps an existing tier.",
 *     "details": [{ "field": "minQty", "issue": "overlaps tier [10,20]" }],
 *     "correlationId": "5f3c..."
 *   }
 * }
 * ```
 */

/** A single structured detail describing one offending field/issue. */
export interface ErrorDetail {
  field?: string;
  issue: string;
  [key: string]: unknown;
}

/** The inner error object. */
export interface ErrorBody {
  /** Stable, machine-readable code (e.g. `TIER_OVERLAP`, `INSUFFICIENT_STOCK`). */
  code: string;
  /** Human-readable message safe to surface to clients. */
  message: string;
  /** Optional list of field-level problems. */
  details?: ErrorDetail[];
  /** Correlation id tying this error to the originating request and logs. */
  correlationId: string;
}

/** The full error envelope returned in HTTP response bodies. */
export interface ErrorEnvelope {
  error: ErrorBody;
}

/**
 * Build a standard error envelope.
 *
 * @param code Stable machine-readable error code.
 * @param message Human-readable, client-safe message.
 * @param correlationId Correlation id for the request.
 * @param details Optional field-level details.
 */
export function makeError(
  code: string,
  message: string,
  correlationId: string,
  details?: ErrorDetail[],
): ErrorEnvelope {
  const error: ErrorBody = { code, message, correlationId };
  if (details && details.length > 0) {
    error.details = details;
  }
  return { error };
}

/**
 * Application error carrying an HTTP status, a stable code, and optional details.
 *
 * Throw this from handlers/services; a shared error-handling middleware (added per service)
 * converts it into an {@link ErrorEnvelope} response with the request's correlation id.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /** Render this error as the standard envelope, stamping the correlation id. */
  toEnvelope(correlationId: string): ErrorEnvelope {
    return makeError(this.code, this.message, correlationId, this.details);
  }
}
