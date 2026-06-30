"""Runtime configuration for the Search Service, sourced from environment variables.

Mirrors the Compose/`.env` conventions (``ELASTICSEARCH_URL``, ``REDIS_URL``, ``SEARCH_PORT``)
so the service behaves identically locally and in containers.
"""

from __future__ import annotations

import os
from dataclasses import dataclass

# Index + stream names are fixed by the design (Data Models → Search; Internal Eventing).
PRODUCTS_INDEX = "products"
PRODUCT_INDEX_STREAM = "product.index"
PRODUCT_INDEX_GROUP = "search-indexer"

# Pagination bounds (Req 8.7).
DEFAULT_PAGE_SIZE = 20
MIN_PAGE_SIZE = 1
MAX_PAGE_SIZE = 100

# Query length bounds (Req 8.1, 8.8).
MIN_QUERY_LEN = 1
MAX_QUERY_LEN = 200

# Fuzzy matching parameters (Deep-Dive 5 → Query construction; Req 8.2).
FUZZINESS = 2
PREFIX_LENGTH = 1


@dataclass(frozen=True)
class Settings:
    """Immutable view of environment-derived settings."""

    elasticsearch_url: str
    redis_url: str
    service_port: int
    log_level: str
    consumer_name: str

    @staticmethod
    def from_env() -> Settings:
        return Settings(
            elasticsearch_url=os.getenv("ELASTICSEARCH_URL", "http://localhost:9200"),
            redis_url=os.getenv("REDIS_URL", "redis://localhost:6379"),
            service_port=int(os.getenv("SEARCH_PORT", "8000")),
            log_level=os.getenv("LOG_LEVEL", "info").upper(),
            # Unique-ish consumer name so multiple replicas don't collide in the group.
            consumer_name=os.getenv("HOSTNAME", f"search-{os.getpid()}"),
        )


settings = Settings.from_env()
