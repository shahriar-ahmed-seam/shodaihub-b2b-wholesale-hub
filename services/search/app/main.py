"""FastAPI application entry point for the Search Service.

Wires the correlation-id middleware, the standard error envelope, the ElasticSearch index
bootstrap, the Redis Streams index consumer, and the search/internal/health routes
(Milestone 7; Req 8, 20.1, 20.2).
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from elasticsearch import AsyncElasticsearch
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from redis.asyncio import Redis
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import DEFAULT_PAGE_SIZE, settings
from .consumer import IndexConsumer, handle_event
from .errors import (
    AppError,
    ServiceUnavailableError,
    app_error_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_error_handler,
)
from .es_client import check_health, create_client, ensure_index
from .indexer import delete_product
from .logging_config import configure_logging, get_logger
from .middleware import CorrelationIdMiddleware
from .models import HealthResponse, IndexRequest, SearchResponse
from .query import (
    SearchParams,
    validate_price_range,
    validate_query,
)
from .search_service import execute_search

configure_logging(settings.log_level)
logger = get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Open ES + Redis connections, bootstrap the index, and start the stream consumer."""
    es = create_client(settings.elasticsearch_url)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    app.state.es = es
    app.state.redis = redis
    app.state.consumer = None

    try:
        await ensure_index(es)
    except Exception as exc:  # noqa: BLE001 - service still boots; health reports ES down
        logger.warning("index_bootstrap_failed", error=str(exc))

    try:
        consumer = IndexConsumer(redis, es, settings.consumer_name)
        await consumer.start()
        app.state.consumer = consumer
    except Exception as exc:  # noqa: BLE001 - consumer optional at boot; fallbacks remain
        logger.warning("consumer_start_failed", error=str(exc))

    try:
        yield
    finally:
        if app.state.consumer is not None:
            await app.state.consumer.stop()
        await es.close()
        await redis.aclose()


app = FastAPI(
    title="B2B-Wholesale-Hub Search Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(CorrelationIdMiddleware)
app.add_exception_handler(AppError, app_error_handler)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)


def _es(request: Request) -> AsyncElasticsearch:
    return request.app.state.es


@app.get("/search/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    """Readiness probe — reports ElasticSearch connectivity (Req 20.1)."""
    es_ok = await check_health(_es(request))
    return HealthResponse(
        status="ok" if es_ok else "degraded",
        elasticsearch="up" if es_ok else "down",
    )


@app.get("/search", response_model=SearchResponse)
async def search(
    request: Request,
    q: str | None = Query(default=None, description="Search query (1-200 chars)."),
    category: str | None = Query(default=None),
    minPrice: float | None = Query(default=None),
    maxPrice: float | None = Query(default=None),
    minSellableQty: int | None = Query(default=None, ge=0),
    page: int = Query(default=1, ge=1),
    size: int | None = Query(default=None),
) -> SearchResponse:
    """Fuzzy product search with conjunctive filters and pagination (Req 8.1-8.4, 8.7-8.10)."""
    query = validate_query(q)
    validate_price_range(minPrice, maxPrice)

    params = SearchParams(
        query=query,
        category=category,
        min_price=minPrice,
        max_price=maxPrice,
        min_sellable_qty=minSellableQty,
        page=page,
        size=size if size is not None else DEFAULT_PAGE_SIZE,
    )
    try:
        return await execute_search(_es(request), params)
    except AppError:
        raise
    except Exception as exc:  # noqa: BLE001 - surface ES failures as 503
        raise ServiceUnavailableError("Search backend is unavailable.") from exc


@app.post("/internal/index", status_code=202)
async def internal_index(request: Request, body: IndexRequest) -> dict[str, str]:
    """Event-consumer fallback: upsert a product document (Req 8.6)."""
    await handle_event(
        _es(request),
        {"op": "upsert", "productId": body.doc.productId, "doc": body.doc.model_dump_json()},
        refresh=True,
    )
    return {"status": "indexed", "productId": body.doc.productId}


@app.delete("/internal/index/{product_id}", status_code=202)
async def internal_deindex(request: Request, product_id: str) -> dict[str, str]:
    """Event-consumer fallback: remove a product document (Req 4.6, 16.4)."""
    await delete_product(_es(request), product_id, refresh=True)
    return {"status": "deleted", "productId": product_id}
