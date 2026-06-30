"""Structured JSON logging for the Search Service.

Uses structlog with ``contextvars`` so the correlation id bound by the HTTP middleware is
attached to every log line emitted during a request, matching the platform observability
convention: JSON logs with ``timestamp, level, service, correlationId, message, context``
(Design → Observability, Req 20.2).
"""

from __future__ import annotations

import logging

import structlog

SERVICE_NAME = "search"


def configure_logging(level: str = "INFO") -> None:
    """Configure structlog + stdlib logging to emit JSON to stdout."""
    log_level = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(format="%(message)s", level=log_level)

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
            _add_service_name,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(log_level),
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def _add_service_name(_logger: object, _name: str, event_dict: dict) -> dict:
    event_dict.setdefault("service", SERVICE_NAME)
    return event_dict


def get_logger(*args: object, **kwargs: object) -> structlog.stdlib.BoundLogger:
    return structlog.get_logger(*args, **kwargs)
