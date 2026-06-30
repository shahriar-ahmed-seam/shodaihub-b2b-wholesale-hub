"""Shared error envelope and exception handling for the Search Service.

Every error response uses the platform-standard shape (Design → Error Handling):

    { "error": { "code", "message", "details", "correlationId" } }
"""

from __future__ import annotations

from typing import Any

import structlog
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .middleware import CORRELATION_ID_HEADER, get_correlation_id

logger = structlog.get_logger()


class AppError(Exception):
    """Base class for domain errors that map onto the standard error envelope."""

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int,
        details: list[dict[str, Any]] | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or []


class QueryValidationError(AppError):
    """Empty/whitespace or out-of-range search query (Req 8.8)."""

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__("QUERY_VALIDATION_ERROR", message, 422, details)


class FilterValidationError(AppError):
    """Invalid filter, e.g. price range min > max (Req 8.9)."""

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__("FILTER_VALIDATION_ERROR", message, 422, details)


class ServiceUnavailableError(AppError):
    """A required dependency (ElasticSearch) is unavailable."""

    def __init__(self, message: str, details: list[dict[str, Any]] | None = None) -> None:
        super().__init__("SERVICE_UNAVAILABLE", message, 503, details)


def _envelope(
    request: Request,
    code: str,
    message: str,
    details: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "correlationId": get_correlation_id(request),
        }
    }


def _json_error(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: list[dict[str, Any]],
) -> JSONResponse:
    correlation_id = get_correlation_id(request)
    response = JSONResponse(
        status_code=status_code,
        content=_envelope(request, code, message, details),
    )
    if correlation_id:
        response.headers[CORRELATION_ID_HEADER] = correlation_id
    return response


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.info("app_error", code=exc.code, message=exc.message, status=exc.status_code)
    return _json_error(request, exc.status_code, exc.code, exc.message, exc.details)


async def validation_error_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    details = [
        {"field": ".".join(str(p) for p in err.get("loc", [])), "issue": err.get("msg", "")}
        for err in exc.errors()
    ]
    return _json_error(
        request, 422, "VALIDATION_ERROR", "Request validation failed.", details
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    return _json_error(
        request, exc.status_code, "HTTP_ERROR", str(exc.detail), []
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("unhandled_exception", error=str(exc))
    return _json_error(
        request, 500, "INTERNAL_ERROR", "An unexpected error occurred.", []
    )
