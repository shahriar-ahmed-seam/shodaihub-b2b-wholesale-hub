"""Pydantic models for the Search Service request/response contracts."""

from __future__ import annotations

from pydantic import BaseModel, Field

PUBLISHED = "PUBLISHED"


class ProductDoc(BaseModel):
    """A product document as stored in the ``products`` ES index (Data Models → Search)."""

    productId: str
    supplierId: str
    name: str
    description: str = ""
    category: str
    basePrice: float
    sellableQty: int = 0
    status: str = PUBLISHED
    avgRating: float | None = None
    updatedAt: str | None = None

    def to_source(self) -> dict:
        """Serialize to the ES ``_source`` document, dropping null optionals."""
        return {k: v for k, v in self.model_dump().items() if v is not None}


class SearchHit(BaseModel):
    """A single search result, including its relevance score."""

    productId: str
    supplierId: str
    name: str
    description: str = ""
    category: str
    basePrice: float
    sellableQty: int = 0
    status: str
    avgRating: float | None = None
    score: float


class SearchResponse(BaseModel):
    """Paginated search result envelope (Req 8.1, 8.4, 8.7, 8.10)."""

    results: list[SearchHit]
    total: int
    page: int
    size: int
    noResults: bool = Field(
        description="True when the result set is empty (Req 8.4 no-results indicator)."
    )


class IndexRequest(BaseModel):
    """Body for the internal upsert fallback (Req 8.6)."""

    doc: ProductDoc


class HealthResponse(BaseModel):
    status: str
    service: str = "search"
    elasticsearch: str
