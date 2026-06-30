"""Correlation-id middleware.

Reads an inbound ``X-Correlation-Id`` (or generates one), binds it into structlog
``contextvars`` so it appears on every log line for the request, stashes it on
``request.state`` for the error handlers, and echoes it on the response (Req 20.2).
"""

from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

CORRELATION_ID_HEADER = "X-Correlation-Id"


def get_correlation_id(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):  # type: ignore[override]
        correlation_id = request.headers.get(CORRELATION_ID_HEADER) or str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(correlationId=correlation_id)
        try:
            response: Response = await call_next(request)
        finally:
            structlog.contextvars.clear_contextvars()

        response.headers[CORRELATION_ID_HEADER] = correlation_id
        return response
