"""Unit tests for the Redis Streams event parsing and idempotent index handlers."""

from __future__ import annotations

import json

import pytest
from elasticsearch import NotFoundError

from app.consumer import handle_event, parse_event
from app.models import ProductDoc

SAMPLE_DOC = {
    "productId": "p1",
    "supplierId": "s1",
    "name": "Basmati Rice",
    "description": "premium long grain",
    "category": "grains",
    "basePrice": 120.5,
    "sellableQty": 40,
    "status": "PUBLISHED",
}


class FakeES:
    """Minimal async ElasticSearch stand-in recording index/delete calls."""

    def __init__(self, *, missing: bool = False) -> None:
        self.indexed: list[tuple[str, dict]] = []
        self.deleted: list[str] = []
        self._missing = missing

    async def index(self, *, index, id, document, refresh=False):  # noqa: A002
        self.indexed.append((id, document))

    async def delete(self, *, index, id, refresh=False):  # noqa: A002
        if self._missing:
            raise NotFoundError("not found", meta=None, body=None)
        self.deleted.append(id)


def test_parse_upsert_event():
    op, product_id, doc = parse_event({"op": "upsert", "doc": json.dumps(SAMPLE_DOC)})
    assert op == "upsert"
    assert product_id == "p1"
    assert isinstance(doc, ProductDoc)
    assert doc.name == "Basmati Rice"


def test_parse_delete_event_by_id():
    op, product_id, doc = parse_event({"op": "delete", "productId": "p9"})
    assert op == "delete"
    assert product_id == "p9"
    assert doc is None


def test_parse_rejects_unknown_op():
    with pytest.raises(ValueError):
        parse_event({"op": "patch", "productId": "p1"})


def test_parse_rejects_upsert_without_doc():
    with pytest.raises(ValueError):
        parse_event({"op": "upsert", "productId": "p1"})


def test_parse_rejects_missing_product_id():
    with pytest.raises(ValueError):
        parse_event({"op": "delete"})


async def test_handle_upsert_indexes_document():
    es = FakeES()
    await handle_event(es, {"op": "upsert", "doc": json.dumps(SAMPLE_DOC)})
    assert es.indexed and es.indexed[0][0] == "p1"


async def test_handle_delete_removes_document():
    es = FakeES()
    await handle_event(es, {"op": "delete", "productId": "p1"})
    assert es.deleted == ["p1"]


async def test_handle_delete_missing_is_idempotent_noop():
    es = FakeES(missing=True)
    # Should not raise even though the document does not exist.
    await handle_event(es, {"op": "delete", "productId": "ghost"})
    assert es.deleted == []


async def test_handle_upsert_is_idempotent_overwrite():
    es = FakeES()
    event = {"op": "upsert", "doc": json.dumps(SAMPLE_DOC)}
    await handle_event(es, event)
    await handle_event(es, event)
    # Same document id used both times (idempotent upsert by productId).
    assert [doc_id for doc_id, _ in es.indexed] == ["p1", "p1"]
