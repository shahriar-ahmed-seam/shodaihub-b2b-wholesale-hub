package com.b2bwholesalehub.inventory.pricing;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import net.jqwik.api.Arbitraries;
import net.jqwik.api.Arbitrary;
import net.jqwik.api.Combinators;
import net.jqwik.api.ForAll;
import net.jqwik.api.Property;
import net.jqwik.api.Provide;
import net.jqwik.api.constraints.IntRange;

/**
 * Feature: b2b-wholesale-hub, Property 1: Tiered price resolution is correct and boundary-inclusive
 * — for any product with non-overlapping tiers and any positive quantity q, the resolved per-unit
 * price equals the unit price of the unique tier whose inclusive [min,max] range contains q, or the
 * base price if none contains q; the tier boundaries themselves resolve to that tier's price.
 *
 * <p>**Validates: Requirements 5.1, 5.6, 5.7**
 */
class PriceResolutionPropertyTest {

  /** A contiguous tier segment of a given width and price. */
  record Seg(int width, BigDecimal price) {}

  @Property(tries = 200)
  void resolvesContainingTierAtAllBoundariesAndBaseOutside(
      @ForAll("segments") List<Seg> segments,
      @ForAll("validPrice") BigDecimal basePrice,
      @ForAll @IntRange(min = 1, max = 100) int beyondOffset) {

    // Build disjoint, contiguous tiers: tier i covers [start, start + width - 1].
    List<TierRange> tiers = new ArrayList<>();
    int start = 1;
    for (Seg seg : segments) {
      int min = start;
      int max = start + seg.width() - 1;
      tiers.add(new TierRange(min, max, seg.price()));
      start = max + 1;
    }
    int totalCovered = start - 1;

    // Every tier boundary (and midpoint) resolves to that tier's price.
    for (TierRange tier : tiers) {
      assertThat(PriceResolver.resolveUnitPrice(basePrice, tiers, tier.minQty()))
          .isEqualByComparingTo(tier.unitPrice());
      assertThat(PriceResolver.resolveUnitPrice(basePrice, tiers, tier.maxQty()))
          .isEqualByComparingTo(tier.unitPrice());
      int mid = tier.minQty() + (tier.maxQty() - tier.minQty()) / 2;
      assertThat(PriceResolver.resolveUnitPrice(basePrice, tiers, mid))
          .isEqualByComparingTo(tier.unitPrice());
    }

    // A quantity beyond all tier coverage resolves to the base price.
    int beyond = totalCovered + beyondOffset;
    assertThat(PriceResolver.resolveUnitPrice(basePrice, tiers, beyond))
        .isEqualByComparingTo(basePrice);
  }

  @Provide
  Arbitrary<List<Seg>> segments() {
    Arbitrary<Integer> width = Arbitraries.integers().between(1, 50);
    Arbitrary<Seg> seg = Combinators.combine(width, validPrice()).as((w, p) -> new Seg(w, p));
    return seg.list().ofMaxSize(8);
  }

  @Provide
  Arbitrary<BigDecimal> validPrice() {
    return Arbitraries.longs().between(1L, 99_999_999L).map(cents -> BigDecimal.valueOf(cents, 2));
  }
}
