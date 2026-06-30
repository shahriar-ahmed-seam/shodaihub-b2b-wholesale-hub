"""Idempotent index maintenance: upsert/delete product documents by productId.

Shared by the Redis Streams consumer and the internal HTTP fallbacks (Req 4.4-4.6, 6.3,
8.6, 16.4). Upsert uses the productId as the ES document id, so re-processing the same
event is a no-op overwrite; delete tolerates a missing document.
"""

from __future__ import annotations

import structlog
from elasticsearch import AsyncElasticsearch, NotFoundError

from .config import PRODUCTS_INDEX
from .models import ProductDoc

logger = structlog.get_logger()


async def upsert_product(
    client: AsyncElasticsearch, doc: ProductDoc, *, refresh: bool = False
) -> None:
    """Index (create or overwrite) a product document keyed by productId (idempotent)."""
    await client.index(
        index=PRODUCTS_INDEX,
        id=doc.productId,
        document=doc.to_source(),
        refresh=refresh,
    )
    logger.info("product_indexed", productId=doc.productId, status=doc.status)


async def delete_product(
    client: AsyncElasticsearch, product_id: str, *, refresh: bool = False
) -> None:
    """Remove a product document by id; a missing document is treated as success (idempotent)."""
    try:
        await client.delete(index=PRODUCTS_INDEX, id=product_id, refresh=refresh)
        logger.info("product_deindexed", productId=product_id)
    except NotFoundError:
        logger.info("product_deindex_noop", productId=product_id)
