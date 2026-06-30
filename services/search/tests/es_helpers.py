"""Coroutine helpers shared by the ElasticSearch-backed property tests."""

from __future__ import annotations

from elasticsearch import AsyncElasticsearch

from app.config import PRODUCTS_INDEX
from app.es_client import ensure_index
from app.indexer import upsert_product
from app.models import ProductDoc


async def reset_index(es: AsyncElasticsearch) -> None:
    """Drop and recreate the products index so each example starts clean."""
    await es.options(ignore_status=[404]).indices.delete(index=PRODUCTS_INDEX)
    await ensure_index(es)


async def index_docs(es: AsyncElasticsearch, docs: list[ProductDoc]) -> None:
    """Index documents and refresh so they are immediately searchable."""
    for doc in docs:
        await upsert_product(es, doc, refresh=False)
    await es.indices.refresh(index=PRODUCTS_INDEX)
