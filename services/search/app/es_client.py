"""ElasticSearch async client helpers: client construction, index bootstrap, and health.

Uses the official ``elasticsearch`` async client (Req 20.1).
"""

from __future__ import annotations

import structlog
from elasticsearch import AsyncElasticsearch

from .config import PRODUCTS_INDEX
from .index_mapping import INDEX_MAPPINGS, INDEX_SETTINGS

logger = structlog.get_logger()


def create_client(url: str) -> AsyncElasticsearch:
    """Create an async ElasticSearch client for the given URL."""
    return AsyncElasticsearch(hosts=[url])


async def ensure_index(client: AsyncElasticsearch, index: str = PRODUCTS_INDEX) -> None:
    """Create the products index with the fuzzy_text analyzer mapping if absent (idempotent)."""
    if await client.indices.exists(index=index):
        return
    await client.indices.create(
        index=index,
        settings=INDEX_SETTINGS,
        mappings=INDEX_MAPPINGS,
    )
    logger.info("index_created", index=index)


async def check_health(client: AsyncElasticsearch) -> bool:
    """Return True when ElasticSearch is reachable (used by the readiness probe, Req 20.1)."""
    try:
        return bool(await client.ping())
    except Exception as exc:  # noqa: BLE001 - ping failure must not raise from health
        logger.warning("es_ping_failed", error=str(exc))
        return False
