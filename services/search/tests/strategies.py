"""Hypothesis strategies and pure edit-distance generation used by the property tests.

The edit generation is deliberately pure (no ES) so it can be reasoned about and Hypothesis-
tested directly: applying ``k`` single-character edits yields a string whose Damerau-Levenshtein
distance from the original is at most ``k``. The query mutations preserve the first character so
they remain matchable under the search query's ``prefix_length: 1`` setting.
"""

from __future__ import annotations

from hypothesis import strategies as st

LOWER = "abcdefghijklmnopqrstuvwxyz"

# A single, analyzer-stable word: lowercase ASCII, long enough to survive two suffix edits.
base_words = st.text(alphabet=LOWER, min_size=4, max_size=10)

categories = st.sampled_from(["grains", "spices", "textiles", "electronics", "dairy"])
statuses = st.sampled_from(["PUBLISHED", "DRAFT", "UNPUBLISHED", "OUT_OF_STOCK", "REMOVED"])


def damerau_levenshtein(a: str, b: str) -> int:
    """Optimal string alignment distance (insertion/deletion/substitution/transposition)."""
    la, lb = len(a), len(b)
    d = [[0] * (lb + 1) for _ in range(la + 1)]
    for i in range(la + 1):
        d[i][0] = i
    for j in range(lb + 1):
        d[0][j] = j
    for i in range(1, la + 1):
        for j in range(1, lb + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            d[i][j] = min(
                d[i - 1][j] + 1,  # deletion
                d[i][j - 1] + 1,  # insertion
                d[i - 1][j - 1] + cost,  # substitution
            )
            if (
                i > 1
                and j > 1
                and a[i - 1] == b[j - 2]
                and a[i - 2] == b[j - 1]
            ):
                d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)  # transposition
    return d[la][lb]


def true_damerau_levenshtein(a: str, b: str) -> int:
    """Unrestricted Damerau-Levenshtein distance — a true metric over insertion, deletion,
    substitution, and adjacent transposition.

    Unlike :func:`damerau_levenshtein` (optimal string alignment, which forbids editing a
    substring more than once and therefore is *not* a metric), this satisfies the triangle
    inequality. It equals the minimum number of elementary edit operations, so it bounds what
    the edit generator can produce: applying ``k`` single-character edits yields a string whose
    true distance from the original is at most ``k``. Lucene's ``fuzziness`` uses the OSA
    variant, which is why the ES-backed Property 19 gates on :func:`damerau_levenshtein`.
    """
    la, lb = len(a), len(b)
    max_dist = la + lb
    d = [[0] * (lb + 2) for _ in range(la + 2)]
    d[0][0] = max_dist
    for i in range(la + 1):
        d[i + 1][0] = max_dist
        d[i + 1][1] = i
    for j in range(lb + 1):
        d[0][j + 1] = max_dist
        d[1][j + 1] = j
    last_row: dict[str, int] = {}
    for i in range(1, la + 1):
        last_match_col = 0
        for j in range(1, lb + 1):
            i_prime = last_row.get(b[j - 1], 0)
            j_prime = last_match_col
            if a[i - 1] == b[j - 1]:
                cost = 0
                last_match_col = j
            else:
                cost = 1
            d[i + 1][j + 1] = min(
                d[i][j] + cost,  # substitution
                d[i + 1][j] + 1,  # insertion
                d[i][j + 1] + 1,  # deletion
                d[i_prime][j_prime]
                + (i - i_prime - 1)
                + 1
                + (j - j_prime - 1),  # transposition
            )
        last_row[a[i - 1]] = i
    return d[la + 1][lb + 1]


def _apply_one_edit(word: str, op: str, pos: int, ch: str) -> str:
    """Apply a single edit confined to the suffix (index >= 1) so the first char is preserved."""
    n = len(word)
    if op == "substitute" and n >= 2:
        i = 1 + (pos % (n - 1))
        if word[i] == ch:  # ensure it is a real change
            ch = LOWER[(LOWER.index(ch) + 1) % len(LOWER)]
        return word[:i] + ch + word[i + 1 :]
    if op == "insert":
        i = 1 + (pos % n)  # insertion point in [1, n]
        return word[:i] + ch + word[i:]
    if op == "delete" and n >= 3:
        i = 1 + (pos % (n - 1))
        return word[:i] + word[i + 1 :]
    if op == "transpose" and n >= 3:
        i = 1 + (pos % (n - 2))
        return word[:i] + word[i + 1] + word[i] + word[i + 2 :]
    # Fallback (word too short for the chosen op): a safe suffix substitution/insert.
    return word + ch


@st.composite
def query_within_two_edits(draw: st.DrawFn, word: str) -> str:
    """Produce a query derived from ``word`` by at most two first-char-preserving edits."""
    num_edits = draw(st.integers(min_value=0, max_value=2))
    mutated = word
    for _ in range(num_edits):
        op = draw(st.sampled_from(["substitute", "insert", "delete", "transpose"]))
        pos = draw(st.integers(min_value=0, max_value=20))
        ch = draw(st.sampled_from(LOWER))
        mutated = _apply_one_edit(mutated, op, pos, ch)
    return mutated
