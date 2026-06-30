"""Unit tests for search response mapping (no ElasticSearch required)."""

from __future__ import annotations

from app.query import SearchParams
from app.search_service import execute_search


class FakeES:
    def __init__(self, response: dict) -> None:
        self._response = response
        self.last_body: dict | None = None

    async def search(self, *, index, body):  # noqa: A002
        self.last_body = body
        return self._response


def _hit(pid: str, score: float) -> dict:
    return {
        "_id": pid,
        "_score": score,
        "_source": {
            "productId": pid,
            "supplierId": "s1",
            "name": pid,
            "description": "",
            "category": "grains",
            "basePrice": 12.0,
            "sellableQty": 5,
            "status": "PUBLISHED",
        },
    }


async def test_execute_search_maps_hits_and_total():
    es = FakeES(
        {"hits": {"total": {"value": 2}, "hits": [_hit("a", 2.5), _hit("b", 1.0)]}}
    )
    result = await execute_search(es, SearchParams(query="rice"))
    assert result.total == 2
    assert [h.productId for h in result.results] == ["a", "b"]
    assert result.noResults is False
    assert result.size == 20
    assert result.page == 1


async def test_execute_search_empty_sets_no_results_indicator():
    # Page beyond last → empty results but total still reported (Req 8.4, 8.10).
    es = FakeES({"hits": {"total": {"value": 42}, "hits": []}})
    result = await execute_search(es, SearchParams(query="rice", page=99))
    assert result.results == []
    assert result.total == 42
    assert result.noResults is True
    assert result.page == 99
