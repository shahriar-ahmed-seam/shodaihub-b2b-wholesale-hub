"""Search execution against ElasticSearch using the pure query builder.

Translates validated :class:`SearchParams` into an ES request and maps the response into the
:class:`SearchResponse` envelope, including the no-results indicator (Req 8.4) and total count
for pages beyond the last (Req 8.10).
"""

from __future__ import annotations

from elasticsearch import AsyncElasticsearch

from .config import PRODUCTS_INDEX
from .models import SearchHit, SearchResponse
from .query import SearchParams, build_search_body, clamp_page_size, normalize_page


def _hit_to_result(hit: dict) -> SearchHit:
    source = hit.get("_source", {})
    return SearchHit(
        productId=source.get("productId", hit.get("_id", "")),
        supplierId=source.get("supplierId", ""),
        name=source.get("name", ""),
        description=source.get("description", ""),
        category=source.get("category", ""),
        basePrice=source.get("basePrice", 0.0),
        sellableQty=source.get("sellableQty", 0),
        status=source.get("status", ""),
        avgRating=source.get("avgRating"),
        score=hit.get("_score") or 0.0,
    )


def _total_value(raw_total: object) -> int:
    if isinstance(raw_total, dict):
        return int(raw_total.get("value", 0))
    if isinstance(raw_total, int):
        return raw_total
    return 0


async def execute_search(
    client: AsyncElasticsearch, params: SearchParams
) -> SearchResponse:
    """Run the search and shape the paginated response."""
    body = build_search_body(params)
    response = await client.search(index=PRODUCTS_INDEX, body=body)

    hits_section = response.get("hits", {})
    hit_list = hits_section.get("hits", [])
    total = _total_value(hits_section.get("total", 0))

    results = [_hit_to_result(h) for h in hit_list]
    return SearchResponse(
        results=results,
        total=total,
        page=normalize_page(params.page),
        size=clamp_page_size(params.size),
        noResults=len(results) == 0,
    )
