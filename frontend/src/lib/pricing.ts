import type { PricingTier } from './api/types';

/**
 * Client-side pricing helpers that mirror the Inventory Service's authoritative rules so the
 * supplier TierEditor can give live validation feedback (design: TierEditor "live overlap
 * validation mirroring Property 3") and product pages can preview tier resolution. The server
 * remains the source of truth; these are UX aids only.
 */

export interface TierDraft {
  minQty: number | '';
  maxQty: number | '';
  unitPrice: number | '';
}

export type TierIssue =
  | { kind: 'range'; index: number }
  | { kind: 'quantity'; index: number }
  | { kind: 'price'; index: number }
  | { kind: 'overlap'; index: number; otherIndex: number };

const QTY_MIN = 1;
const QTY_MAX = 999999;
const PRICE_MIN = 0.01;
const PRICE_MAX = 999999.99;

function isInteger(value: number): boolean {
  return Number.isInteger(value);
}

function hasAtMostTwoDecimals(value: number): boolean {
  return Math.round(value * 100) === value * 100;
}

/** Do two inclusive integer ranges overlap? (Req 5.2 — inclusive of both bounds.) */
export function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && bMin <= aMax;
}

/**
 * Validate a full set of tier drafts, returning every issue found (Req 5.2–5.5). Mirrors the
 * server rules: integer qty in [1,999999], min ≤ max, price in [0.01,999999.99] with ≤2 decimals,
 * and no overlapping inclusive ranges. Empty/blank drafts are skipped (treated as not-yet-entered).
 */
export function validateTiers(tiers: TierDraft[]): TierIssue[] {
  const issues: TierIssue[] = [];
  const complete: Array<{ index: number; minQty: number; maxQty: number; unitPrice: number }> = [];

  tiers.forEach((tier, index) => {
    if (tier.minQty === '' || tier.maxQty === '' || tier.unitPrice === '') return;
    const minQty = Number(tier.minQty);
    const maxQty = Number(tier.maxQty);
    const unitPrice = Number(tier.unitPrice);

    let valid = true;
    if (!isInteger(minQty) || !isInteger(maxQty) || minQty < QTY_MIN || maxQty > QTY_MAX) {
      issues.push({ kind: 'quantity', index });
      valid = false;
    }
    if (minQty > maxQty) {
      issues.push({ kind: 'range', index });
      valid = false;
    }
    if (unitPrice < PRICE_MIN || unitPrice > PRICE_MAX || !hasAtMostTwoDecimals(unitPrice)) {
      issues.push({ kind: 'price', index });
      valid = false;
    }
    if (valid) complete.push({ index, minQty, maxQty, unitPrice });
  });

  for (let i = 0; i < complete.length; i += 1) {
    for (let j = i + 1; j < complete.length; j += 1) {
      const a = complete[i]!;
      const b = complete[j]!;
      if (rangesOverlap(a.minQty, a.maxQty, b.minQty, b.maxQty)) {
        issues.push({ kind: 'overlap', index: b.index, otherIndex: a.index });
      }
    }
  }

  return issues;
}

/**
 * Resolve the per-unit price for a quantity (Req 5.6, 5.7): the unique containing inclusive tier,
 * else the base price.
 */
export function resolveUnitPrice(quantity: number, basePrice: number, tiers: PricingTier[]): number {
  const tier = tiers.find((t) => quantity >= t.minQty && quantity <= t.maxQty);
  return tier ? tier.unitPrice : basePrice;
}
