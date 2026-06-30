"""Pure search-query logic: validation, page-size clamping, and ES query construction.

This module has no I/O and no ElasticSearch dependency so it can be exercised directly by
property-based tests (Deep-Dive 5 → Query construction, Validation).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import (
    DEFAULT_PAGE_SIZE,
    FUZZINESS,
    MAX_PAGE_SIZE,
    MAX_QUERY_LEN,
    MIN_PAGE_SIZE,
    PREFIX_LENGTH,
)
from .errors import FilterValidationError, QueryValidationError
from .models import PUBLISHED


@dataclass(frozen=True)
class SearchParams:
    """Validated search inputs."""

    query: str
    category: str | None = None
    min_price: float | None = None
    max_price: float | None = None
    min_sellable_qty: int | None = None
    page: int = 1
    size: int = DEFAULT_PAGE_SIZE


def clamp_page_size(size: int | None) -> int:
    """Apply the default when no size is supplied and clamp into [1, 100] (Req 8.7)."""
    if size is None:
        return DEFAULT_PAGE_SIZE
    if size < MIN_PAGE_SIZE:
        return MIN_PAGE_SIZE
    if size > MAX_PAGE_SIZE:
        return MAX_PAGE_SIZE
    return size


def normalize_page(page: int | None) -> int:
    """Pages are 1-based; anything below 1 (or absent) becomes page 1."""
    if page is None or page < 1:
        return 1
    return page


def compute_from(page: int, size: int) -> int:
    """ES ``from`` offset for a 1-based page."""
    return (normalize_page(page) - 1) * size


def validate_query(raw: str | None) -> str:
    """Reject empty/whitespace-only queries; enforce the 1-200 length bound (Req 8.1, 8.8)."""
    if raw is None or raw.strip() == "":
        raise QueryValidationError(
            "Search query must not be empty or whitespace.",
            [{"field": "q", "issue": "empty or whitespace"}],
        )
    trimmed = raw.strip()
    if len(trimmed) > MAX_QUERY_LEN:
        raise QueryValidationError(
            f"Search query must be at most {MAX_QUERY_LEN} characters.",
            [{"field": "q", "issue": f"exceeds {MAX_QUERY_LEN} characters"}],
        )
    return trimmed


def validate_price_range(min_price: float | None, max_price: float | None) -> None:
    """Reject a price filter whose minimum exceeds its maximum (Req 8.9)."""
    if min_price is not None and max_price is not None and min_price > max_price:
        raise FilterValidationError(
            "Price range minimum must not exceed maximum.",
            [{"field": "price", "issue": f"min {min_price} > max {max_price}"}],
        )


def build_filters(params: SearchParams) -> list[dict[str, Any]]:
    """Build the conjunctive ``filter`` clauses (Req 8.1 published-only, 8.3 filters)."""
    filters: list[dict[str, Any]] = [{"term": {"status": PUBLISHED}}]

    if params.category is not None:
        filters.append({"term": {"category": params.category}})

    price_range: dict[str, float] = {}
    if params.min_price is not None:
        price_range["gte"] = params.min_price
    if params.max_price is not None:
        price_range["lte"] = params.max_price
    if price_range:
        filters.append({"range": {"basePrice": price_range}})

    if params.min_sellable_qty is not None:
        filters.append({"range": {"sellableQty": {"gte": params.min_sellable_qty}}})

    return filters


def build_search_body(params: SearchParams) -> dict[str, Any]:
    """Construct the full ES request body: fuzzy multi_match + conjunctive filters + sort.

    - ``must``: multi_match over ``name^3, description`` with fuzziness 2, prefix_length 1
      (Req 8.2).
    - ``filter``: status=PUBLISHED plus optional category/price/sellable filters (Req 8.1, 8.3).
    - sorted by ``_score`` desc (Req 8.1); ``from``/``size`` for pagination (Req 8.7).
    """
    size = clamp_page_size(params.size)
    offset = compute_from(params.page, size)

    return {
        "from": offset,
        "size": size,
        "query": {
            "bool": {
                "must": [
                    {
                        "multi_match": {
                            "query": params.query,
                            "fields": ["name^3", "description"],
                            "fuzziness": FUZZINESS,
                            "prefix_length": PREFIX_LENGTH,
                        }
                    }
                ],
                "filter": build_filters(params),
            }
        },
        "sort": [{"_score": {"order": "desc"}}],
    }
