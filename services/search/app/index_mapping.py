"""ElasticSearch index definition for the ``products`` index.

The ``fuzzy_text`` analyzer lowercases and applies an ASCII-folding filter to normalize
Bangla/English transliteration; fuzziness itself is applied at query time, not index time
(Design → Data Models → Search; Deep-Dive 5).
"""

from __future__ import annotations

from typing import Any

# Analyzer: standard tokenizer + lowercase + asciifolding (Data Models → Search).
INDEX_SETTINGS: dict[str, Any] = {
    "analysis": {
        "analyzer": {
            "fuzzy_text": {
                "type": "custom",
                "tokenizer": "standard",
                "filter": ["lowercase", "asciifolding"],
            }
        }
    }
}

INDEX_MAPPINGS: dict[str, Any] = {
    "properties": {
        "productId": {"type": "keyword"},
        "supplierId": {"type": "keyword"},
        "name": {
            "type": "text",
            "analyzer": "fuzzy_text",
            "fields": {"kw": {"type": "keyword"}},
        },
        "description": {"type": "text", "analyzer": "fuzzy_text"},
        "category": {"type": "keyword"},
        "basePrice": {"type": "scaled_float", "scaling_factor": 100},
        "sellableQty": {"type": "integer"},
        "status": {"type": "keyword"},
        "avgRating": {"type": "half_float"},
        "updatedAt": {"type": "date"},
    }
}


def index_definition() -> dict[str, Any]:
    """Full create-index body (settings + mappings)."""
    return {"settings": INDEX_SETTINGS, "mappings": INDEX_MAPPINGS}
