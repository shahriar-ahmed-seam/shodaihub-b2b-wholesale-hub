"""Unit + property tests for the pure query logic (no ElasticSearch required)."""

from __future__ import annotations

import pytest
from hypothesis import given
from hypothesis import strategies as st

from app.config import DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE
from app.errors import FilterValidationError, QueryValidationError
from app.models import PUBLISHED
from app.query import (
    SearchParams,
    build_filters,
    build_search_body,
    clamp_page_size,
    validate_price_range,
    validate_query,
)
from tests.strategies import query_within_two_edits, true_damerau_levenshtein

# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------


def test_clamp_default_when_none():
    assert clamp_page_size(None) == DEFAULT_PAGE_SIZE


def test_clamp_below_floor():
    assert clamp_page_size(0) == MIN_PAGE_SIZE
    assert clamp_page_size(-5) == MIN_PAGE_SIZE


def test_clamp_above_ceiling():
    assert clamp_page_size(1000) == MAX_PAGE_SIZE


def test_clamp_within_bounds_is_identity():
    assert clamp_page_size(37) == 37


def test_validate_query_rejects_empty_and_whitespace():
    with pytest.raises(QueryValidationError):
        validate_query("")
    with pytest.raises(QueryValidationError):
        validate_query("   ")
    with pytest.raises(QueryValidationError):
        validate_query(None)


def test_validate_query_trims():
    assert validate_query("  rice  ") == "rice"


def test_validate_query_rejects_overlong():
    with pytest.raises(QueryValidationError):
        validate_query("x" * 201)


def test_validate_price_range_rejects_min_gt_max():
    with pytest.raises(FilterValidationError):
        validate_price_range(100.0, 10.0)


def test_validate_price_range_allows_open_ended():
    validate_price_range(None, 50.0)
    validate_price_range(10.0, None)
    validate_price_range(None, None)
    validate_price_range(10.0, 10.0)


def test_build_filters_always_includes_published():
    filters = build_filters(SearchParams(query="rice"))
    assert {"term": {"status": PUBLISHED}} in filters


def test_build_filters_conjunction_includes_all():
    params = SearchParams(
        query="rice", category="grains", min_price=5.0, max_price=50.0, min_sellable_qty=10
    )
    filters = build_filters(params)
    assert {"term": {"status": PUBLISHED}} in filters
    assert {"term": {"category": "grains"}} in filters
    assert {"range": {"basePrice": {"gte": 5.0, "lte": 50.0}}} in filters
    assert {"range": {"sellableQty": {"gte": 10}}} in filters


def test_build_search_body_structure():
    body = build_search_body(SearchParams(query="rice"))
    must = body["query"]["bool"]["must"][0]["multi_match"]
    assert must["fields"] == ["name^3", "description"]
    assert must["fuzziness"] == 2
    assert must["prefix_length"] == 1
    assert body["sort"] == [{"_score": {"order": "desc"}}]


# ---------------------------------------------------------------------------
# Property 21: Pagination respects page size bounds
# Feature: b2b-wholesale-hub, Property 21: For any requested page size, when the size is
# within 1-100 the number of returned items does not exceed that size, and when no size is
# supplied the default page size of 20 is applied.
# Validates: Requirements 8.7
# ---------------------------------------------------------------------------


@given(size=st.integers(min_value=MIN_PAGE_SIZE, max_value=MAX_PAGE_SIZE))
def test_property21_in_range_size_preserved(size: int):
    assert clamp_page_size(size) == size


@given(size=st.integers())
def test_property21_clamp_always_within_bounds(size: int):
    clamped = clamp_page_size(size)
    assert MIN_PAGE_SIZE <= clamped <= MAX_PAGE_SIZE


def test_property21_none_uses_default():
    assert clamp_page_size(None) == DEFAULT_PAGE_SIZE


@given(
    size=st.one_of(st.none(), st.integers(min_value=-50, max_value=200)),
    page=st.integers(min_value=1, max_value=1000),
)
def test_property21_body_size_within_bounds(size, page):
    params = SearchParams(
        query="rice", page=page, size=size if size is not None else DEFAULT_PAGE_SIZE
    )
    body = build_search_body(params)
    assert MIN_PAGE_SIZE <= body["size"] <= MAX_PAGE_SIZE
    assert body["from"] == (page - 1) * body["size"]
    assert body["from"] >= 0


# ---------------------------------------------------------------------------
# Property: edit-distance generator stays within 2 real edit operations (supports Property 19).
#
# The generator applies at most two single-character edits, so the result is always reachable
# within two elementary operations — i.e. the *true* (metric) Damerau-Levenshtein distance is
# <= 2. Note this is NOT the same as the optimal-string-alignment distance Lucene uses: two
# interacting edits (e.g. a transposition then an insert into the swapped region) can make the
# OSA distance 3. Property 19 therefore verifies the OSA distance per-example with
# `assume(...)` before asserting a match, rather than trusting the generator's edit count.
# ---------------------------------------------------------------------------


@given(word=st.text(alphabet="abcdefghijklmnopqrstuvwxyz", min_size=4, max_size=10), data=st.data())
def test_edit_generator_within_two(word: str, data: st.DataObject):
    mutated = data.draw(query_within_two_edits(word))
    # At most two elementary edit operations were applied (true metric distance).
    assert true_damerau_levenshtein(word, mutated) <= 2
    # First character is preserved so the query remains matchable under prefix_length=1.
    assert mutated[0] == word[0]
