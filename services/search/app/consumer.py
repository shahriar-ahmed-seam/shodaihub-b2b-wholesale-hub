"""Redis Streams consumer for ``product.index`` events.

Maintains the ES index from Inventory's published events using a consumer group for
at-least-once delivery; handlers are idempotent (upsert/delete by productId), so redelivery
is harmless (Req 4.4-4.6, 6.3, 8.6, 16.4).

Stream contract (Design → Internal Eventing):
    { op: "upsert"|"delete", productId, doc?, correlationId }

``doc`` is carried as a JSON string field on the stream entry.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

import structlog
from elasticsearch import AsyncElasticsearch
from redis.asyncio import Redis
from redis.exceptions import ResponseError

from .config import PRODUCT_INDEX_GROUP, PRODUCT_INDEX_STREAM
from .indexer import delete_product, upsert_product
from .models import ProductDoc

logger = structlog.get_logger()


def parse_event(fields: dict[str, Any]) -> tuple[str, str, ProductDoc | None]:
    """Parse a stream entry into (op, productId, doc?). Raises ValueError on bad payloads."""
    op = (fields.get("op") or "").lower()
    if op not in {"upsert", "delete"}:
        raise ValueError(f"unknown op: {op!r}")

    raw_doc = fields.get("doc")
    doc: ProductDoc | None = None
    if raw_doc:
        parsed = json.loads(raw_doc) if isinstance(raw_doc, str) else raw_doc
        doc = ProductDoc.model_validate(parsed)

    product_id = fields.get("productId") or (doc.productId if doc else None)
    if not product_id:
        raise ValueError("missing productId")

    if op == "upsert" and doc is None:
        raise ValueError("upsert event missing doc")

    return op, product_id, doc


async def handle_event(
    es: AsyncElasticsearch, fields: dict[str, Any], *, refresh: bool = False
) -> None:
    """Apply a single product.index event to ES (idempotent)."""
    op, product_id, doc = parse_event(fields)
    if op == "upsert" and doc is not None:
        await upsert_product(es, doc, refresh=refresh)
    else:
        await delete_product(es, product_id, refresh=refresh)


async def ensure_group(redis: Redis) -> None:
    """Create the consumer group, tolerating 'already exists'."""
    try:
        await redis.xgroup_create(
            name=PRODUCT_INDEX_STREAM,
            groupname=PRODUCT_INDEX_GROUP,
            id="0",
            mkstream=True,
        )
        logger.info("consumer_group_created", group=PRODUCT_INDEX_GROUP)
    except ResponseError as exc:
        if "BUSYGROUP" not in str(exc):
            raise


class IndexConsumer:
    """Background task that drains the product.index stream into ElasticSearch."""

    def __init__(self, redis: Redis, es: AsyncElasticsearch, consumer_name: str) -> None:
        self._redis = redis
        self._es = es
        self._consumer_name = consumer_name
        self._task: asyncio.Task | None = None
        self._stop = asyncio.Event()

    async def start(self) -> None:
        await ensure_group(self._redis)
        self._task = asyncio.create_task(self._run(), name="product-index-consumer")
        logger.info("index_consumer_started", consumer=self._consumer_name)

    async def stop(self) -> None:
        self._stop.set()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _run(self) -> None:
        while not self._stop.is_set():
            try:
                messages = await self._redis.xreadgroup(
                    groupname=PRODUCT_INDEX_GROUP,
                    consumername=self._consumer_name,
                    streams={PRODUCT_INDEX_STREAM: ">"},
                    count=50,
                    block=2000,
                )
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 - keep the loop alive on transient errors
                logger.warning("xreadgroup_failed", error=str(exc))
                await asyncio.sleep(1)
                continue

            if not messages:
                continue

            for _stream, entries in messages:
                for entry_id, fields in entries:
                    await self._process(entry_id, fields)

    async def _process(self, entry_id: str, fields: dict[str, Any]) -> None:
        try:
            await handle_event(self._es, fields)
            await self._redis.xack(PRODUCT_INDEX_STREAM, PRODUCT_INDEX_GROUP, entry_id)
        except ValueError as exc:
            # Malformed event: ack so it does not poison the group, but log loudly.
            logger.error("malformed_index_event", entryId=entry_id, error=str(exc))
            await self._redis.xack(PRODUCT_INDEX_STREAM, PRODUCT_INDEX_GROUP, entry_id)
        except Exception as exc:  # noqa: BLE001 - leave unacked for redelivery
            logger.error("index_event_failed", entryId=entry_id, error=str(exc))
