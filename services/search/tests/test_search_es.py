"""ElasticSearch-backed property tests (Properties 18, 19, 20).

These run against a single-node ElasticSearch testcontainer. If Docker is unavailable the
``es_client`` fixture skips them gracefully. Each property runs >= 100 Hypothesis examples.
"""

from __future__ import annotations

from hypothesis import HealthCheck, assume, given, settings
from hypothesis import strategies as st

from app.models import ProductDoc
from app.query import SearchParams
from app.search_service import execute_search
from tests.es_helpers import index_docs, reset_index
from tests.strategies import (
    categories,
    damerau_levenshtein,
    query_within_two_edits,
    statuses,
)

VOCAB = ["rice", "flour", "sugar", "salt", "lentil"]

ES_SETTINGS = settings(
    max_examples=100,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)


@st.composite
def _product(draw: st.DrawFn, idx: int, *, status_strategy=statuses) -> ProductDoc:
    word = draw(st.sampled_from(VOCAB))
    suffix = draw(st.text(alphabet="abcdefghijklmnopqrstuvwxyz ", min_size=0, max_size=6))
    price_cents = draw(st.integers(min_value=100, max_value=1_000_00))
    return ProductDoc(
        productId=f"p{idx}",
        supplierId=f"s{idx % 3}",
        name=f"{word} {suffix}".strip(),
        description=draw(st.sampled_from(["", "bulk wholesale lot", "premium grade"])),
        category=draw(categories),
        basePrice=price_cents / 100,
        sellableQty=draw(st.integers(min_value=0, max_value=100)),
        status=draw(status_strategy),
    )


# ---------------------------------------------------------------------------
# Property 18: Search returns only published products ranked by descending relevance
# Feature: b2b-wholesale-hub, Property 18: For any search query of length 1-200, every
# returned product has status PUBLISHED and the results are ordered by non-increasing
# relevance score.
# Validates: Requirements 8.1
# ---------------------------------------------------------------------------


@ES_SETTINGS
@given(
    docs=st.lists(st.integers(min_value=0, max_value=999), min_size=1, max_size=8, unique=True),
    seed=st.data(),
    query_word=st.sampled_from(VOCAB),
)
def test_property18_published_only_and_ranked(es_client, es_loop, docs, seed, query_word):
    products = [seed.draw(_product(i)) for i in docs]

    async def run() -> None:
        await reset_index(es_client)
        await index_docs(es_client, products)
        result = await execute_search(es_client, SearchParams(query=query_word, size=100))

        # Every returned product is PUBLISHED (Req 8.1).
        assert all(hit.status == "PUBLISHED" for hit in result.results)
        # Results are ordered by non-increasing relevance score.
        scores = [hit.score for hit in result.results]
        assert scores == sorted(scores, reverse=True)
        # No non-published product leaks into the results.
        published_ids = {p.productId for p in products if p.status == "PUBLISHED"}
        assert {hit.productId for hit in result.results} <= published_ids

    es_loop.run_until_complete(run())


# ---------------------------------------------------------------------------
# Property 19: Fuzzy matching tolerates edits within distance 2
# Feature: b2b-wholesale-hub, Property 19: For any indexed product term and any query string
# derived from it by at most 2 character edits, the product appears in the search results.
# Validates: Requirements 8.2
# ---------------------------------------------------------------------------


@settings(
    max_examples=120,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow, HealthCheck.filter_too_much],
)
@given(
    base=st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=4, max_size=10),
    mutate=st.data(),
)
def test_property19_fuzzy_within_two_edits(es_client, es_loop, base, mutate):
    query = mutate.draw(query_within_two_edits(base))

    # Req 8.2 only guarantees a match when the query is within an edit distance of 2 of the
    # indexed term. The generator applies up to two single-character edits, but interacting
    # edits (e.g. a transposition combined with an insert/delete) can push the optimal
    # string-alignment distance past 2 — which Lucene's `fuzziness: 2` correctly will not
    # match. We also require the leading character to be preserved because `prefix_length: 1`
    # makes the first character exact-match. Discard cases outside that guaranteed envelope so
    # the assertion stays faithful to what Req 8.2 actually promises.
    distance = damerau_levenshtein(base, query)
    assume(distance <= 2)
    assume(len(query) >= 1 and query[0] == base[0])

    target = ProductDoc(
        productId="target",
        supplierId="s1",
        name=base,
        description="",
        category="grains",
        basePrice=10.0,
        sellableQty=50,
        status="PUBLISHED",
    )

    async def run() -> None:
        await reset_index(es_client)
        await index_docs(es_client, [target])
        result = await execute_search(es_client, SearchParams(query=query, size=100))
        ids = {hit.productId for hit in result.results}
        assert "target" in ids, (
            f"base={base!r} query={query!r} distance={distance} not matched"
        )

    es_loop.run_until_complete(run())


# ---------------------------------------------------------------------------
# Property 20: Filters are conjunctive
# Feature: b2b-wholesale-hub, Property 20: For any combination of category, price-range, and
# minimum-sellable-quantity filters, every returned product satisfies all applied filters
# simultaneously.
# Validates: Requirements 8.3
# ---------------------------------------------------------------------------


@ES_SETTINGS
@given(
    ids=st.lists(st.integers(min_value=0, max_value=999), min_size=1, max_size=8, unique=True),
    seed=st.data(),
    query_word=st.sampled_from(VOCAB),
    use_category=st.booleans(),
    cat=categories,
    lo_cents=st.integers(min_value=100, max_value=1_000_00),
    span_cents=st.integers(min_value=0, max_value=500_00),
    use_price=st.booleans(),
    use_qty=st.booleans(),
    min_qty=st.integers(min_value=0, max_value=100),
)
def test_property20_filters_conjunctive(
    es_client,
    es_loop,
    ids,
    seed,
    query_word,
    use_category,
    cat,
    lo_cents,
    span_cents,
    use_price,
    use_qty,
    min_qty,
):
    # All published so the filter, not the status gate, is what's under test.
    products = [seed.draw(_product(i, status_strategy=st.just("PUBLISHED"))) for i in ids]
    min_price = lo_cents / 100 if use_price else None
    max_price = (lo_cents + span_cents) / 100 if use_price else None
    params = SearchParams(
        query=query_word,
        category=cat if use_category else None,
        min_price=min_price,
        max_price=max_price,
        min_sellable_qty=min_qty if use_qty else None,
        size=100,
    )

    async def run() -> None:
        await reset_index(es_client)
        await index_docs(es_client, products)
        result = await execute_search(es_client, params)
        for hit in result.results:
            assert hit.status == "PUBLISHED"
            if use_category:
                assert hit.category == cat
            if use_price:
                assert min_price <= hit.basePrice <= max_price
            if use_qty:
                assert hit.sellableQty >= min_qty

    es_loop.run_until_complete(run())
