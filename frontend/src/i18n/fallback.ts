/**
 * Pure translation-fallback resolver (Req 17.4) — covered by Property 41.
 *
 * Given a primary-locale message catalog and an English fallback catalog, resolving a key
 * returns the primary translation when present and non-empty, otherwise the English value,
 * otherwise the key itself. Catalogs are nested objects keyed by dotted paths
 * (e.g. "nav.cart"). This function is deliberately side-effect free and framework-agnostic so
 * it can be exhaustively property-tested without rendering React.
 */

export type MessageTree = { [key: string]: string | MessageTree };

/** Look up a dotted key in a nested catalog; returns undefined when absent or not a leaf string. */
export function lookup(tree: MessageTree | undefined, key: string): string | undefined {
  if (!tree) return undefined;
  const segments = key.split('.');
  let node: string | MessageTree | undefined = tree;
  for (const segment of segments) {
    if (typeof node !== 'object' || node === null) return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

/**
 * Resolve a message key against the selected-locale catalog with an English fallback.
 *
 * Resolution order (Req 17.1, 17.4):
 *   1. non-empty value in the primary catalog,
 *   2. non-empty value in the English fallback catalog,
 *   3. the key itself (never throws, never returns empty for a present-but-blank primary value).
 */
export function translateWithFallback(
  primary: MessageTree | undefined,
  fallback: MessageTree | undefined,
  key: string,
): string {
  const primaryValue = lookup(primary, key);
  if (primaryValue !== undefined && primaryValue.trim() !== '') {
    return primaryValue;
  }
  const fallbackValue = lookup(fallback, key);
  if (fallbackValue !== undefined && fallbackValue.trim() !== '') {
    return fallbackValue;
  }
  return key;
}

/**
 * Deep-merge a partial locale catalog over the English base so that any key missing (or blank)
 * in the partial catalog resolves to the English value. Used to feed next-intl a complete tree
 * (Req 17.4). The English base is never mutated.
 */
export function mergeWithFallback(base: MessageTree, override: MessageTree | undefined): MessageTree {
  if (!override) return structuredCloneTree(base);
  const result: MessageTree = structuredCloneTree(base);
  for (const [key, value] of Object.entries(override)) {
    const baseValue = result[key];
    if (
      typeof value === 'object' &&
      value !== null &&
      typeof baseValue === 'object' &&
      baseValue !== null
    ) {
      result[key] = mergeWithFallback(baseValue, value);
    } else if (typeof value === 'string' && value.trim() !== '') {
      result[key] = value;
    }
    // blank/undefined override values are ignored, preserving the English base (Req 17.4).
  }
  return result;
}

function structuredCloneTree(tree: MessageTree): MessageTree {
  const copy: MessageTree = {};
  for (const [key, value] of Object.entries(tree)) {
    copy[key] = typeof value === 'object' && value !== null ? structuredCloneTree(value) : value;
  }
  return copy;
}
