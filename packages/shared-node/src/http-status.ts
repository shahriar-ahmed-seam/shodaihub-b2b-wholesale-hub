/**
 * HTTP status conventions shared across services.
 *
 * Mirrors the design's "HTTP Status Conventions" table (Error Handling section) so every service
 * maps the same business situation to the same status code and stable error code.
 *
 * | Situation                | Status     | Examples (Req)                                        |
 * |--------------------------|------------|-------------------------------------------------------|
 * | Validation failure       | 400 / 422  | email format 1.8, password policy 1.3, tier range 5.3 |
 * | Authentication failure   | 401        | bad creds 1.5, expired/invalid JWT 2.2, bad refresh   |
 * | Account locked/suspended | 423 / 401  | 1.10, 16.3                                            |
 * | Authorization failure    | 403        | role/ownership 2.3, 2.4                               |
 * | Not found                | 404        | unknown product/order                                 |
 * | Conflict / business rule | 409        | duplicate email 1.2, insufficient stock 7.2, MOQ 9.2  |
 * | Idempotent duplicate     | 200        | duplicate payment callback 11.7                       |
 * | Rejected callback        | 400        | callback authenticity fail 11.8                       |
 * | Upstream/provider error  | 502 / 504  | payment provider timeout                              |
 */

/** Named HTTP status codes used across the platform. */
export const HttpStatus = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  LOCKED: 423,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusName = keyof typeof HttpStatus;
export type HttpStatusCode = (typeof HttpStatus)[HttpStatusName];

import { AppError, type ErrorDetail } from './errors.js';

/**
 * Convention helpers that construct an {@link AppError} with the status code the design assigns
 * to each business situation. Using these keeps status/code mapping consistent across services.
 */
export const Errors = {
  /** 400 — malformed request body/params. */
  badRequest: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.BAD_REQUEST, code, message, details),

  /** 422 — semantically invalid input (validation failure). */
  validation: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.UNPROCESSABLE_ENTITY, code, message, details),

  /** 401 — authentication failure (bad credentials, expired/invalid/missing token). */
  unauthorized: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.UNAUTHORIZED, code, message, details),

  /** 423 — account locked/suspended. */
  locked: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.LOCKED, code, message, details),

  /** 403 — role/ownership authorization failure. */
  forbidden: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.FORBIDDEN, code, message, details),

  /** 404 — resource not found. */
  notFound: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.NOT_FOUND, code, message, details),

  /** 409 — conflict / business-rule violation. */
  conflict: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.CONFLICT, code, message, details),

  /** 429 — rate limited. */
  tooManyRequests: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.TOO_MANY_REQUESTS, code, message, details),

  /** 502 — upstream/provider error. */
  badGateway: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.BAD_GATEWAY, code, message, details),

  /** 504 — upstream/provider timeout. */
  gatewayTimeout: (code: string, message: string, details?: ErrorDetail[]) =>
    new AppError(HttpStatus.GATEWAY_TIMEOUT, code, message, details),
} as const;
