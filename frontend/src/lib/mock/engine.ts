/**
 * Mock API engine. Maps every API path the app calls to the in-memory dataset in `data.ts`,
 * applying real behaviour where it matters (search filtering/fuzzy matching/pagination, order
 * lookups, auth token encode/decode). Framework-neutral (no server-only imports) so it works in
 * both server components and the browser bundle.
 *
 * Errors are thrown as {@link ApiError} with the standard envelope so callers behave identically
 * to the real BFF.
 */

import { ApiError } from '../api/client';
import type {
  Cart,
  Order,
  OrderSummary,
  Paginated,
  Product,
  SearchResponse,
  SessionUser,
} from '../api/types';
import {
  ADMIN_METRICS,
  buildCart,
  buildSessionUser,
  categorySlug,
  DEMO_SUPPLIER_ID,
  KYC_SUBMISSIONS,
  orderById,
  orderSummaries,
  PRODUCTS,
  productById,
  roleForEmail,
  SUPPLIER_SUBORDERS,
  supplierProfileFor,
} from './data';

export interface MockRequest {
  method?: string;
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | boolean | undefined>;
}

// ---------------------------------------------------------------------------
// Token encode/decode (mock bearer = `mock.<base64 of SessionUser JSON>`)
// ---------------------------------------------------------------------------

function toBase64(input: string): string {
  const encoded = encodeURIComponent(input);
  if (typeof btoa === 'function') return btoa(encoded);
  return Buffer.from(encoded, 'utf-8').toString('base64');
}

function fromBase64(input: string): string {
  let raw: string;
  if (typeof atob === 'function') raw = atob(input);
  else raw = Buffer.from(input, 'base64').toString('utf-8');
  return decodeURIComponent(raw);
}

function encodeToken(user: SessionUser): string {
  return `mock.${toBase64(JSON.stringify(user))}`;
}

function decodeToken(token?: string): SessionUser | null {
  if (!token || !token.startsWith('mock.')) return null;
  try {
    const user = JSON.parse(fromBase64(token.slice('mock.'.length))) as SessionUser;
    if (user && typeof user.email === 'string' && typeof user.role === 'string') return user;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Error + utility helpers
// ---------------------------------------------------------------------------

function apiError(status: number, code: string, message: string): ApiError {
  return new ApiError(status, { code, message });
}

function notFound(resource: string): ApiError {
  return apiError(404, 'NOT_FOUND', `${resource} not found`);
}

function asNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function ok(extra: Record<string, unknown> = {}): { ok: true } & Record<string, unknown> {
  return { ok: true, ...extra };
}

// ---------------------------------------------------------------------------
// Search: substring + prefix + fuzzy (edit distance <= 2), category/price/qty filters
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1).fill(0);
  for (let i = 1; i <= m; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n]!;
}

function relevanceScore(product: Product, query: string): number {
  if (!query) return 1;
  const haystack = `${product.name} ${product.description ?? ''} ${product.category} ${product.supplierName ?? ''}`.toLowerCase();
  const words = haystack.split(/[^a-z0-9]+/).filter(Boolean);
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  let score = 0;
  for (const token of tokens) {
    if (haystack.includes(token)) {
      score += 10;
      continue;
    }
    let best = 0;
    for (const word of words) {
      if (word.startsWith(token)) {
        best = Math.max(best, 6);
      } else if (Math.abs(word.length - token.length) <= 2) {
        const distance = levenshtein(word, token);
        if (distance <= 2) best = Math.max(best, 5 - distance);
      }
    }
    score += best;
  }
  return score;
}

const CATEGORY_SYNONYMS: Record<string, string[]> = {
  'grocery & staples': ['food', 'grain', 'beverage'],
  agriculture: ['food', 'grain'],
  household: ['home', 'kitchen'],
};

function categoryMatches(productCategory: string, filter: string): boolean {
  if (!filter) return true;
  const a = productCategory.toLowerCase();
  const f = filter.toLowerCase().trim();
  if (a === f || a.includes(f) || f.includes(a)) return true;
  const stop = new Set(['and', 'the', 'of']);
  const tokenize = (s: string) => s.split(/[^a-z]+/).filter((w) => w.length >= 4 && !stop.has(w));
  const at = tokenize(a);
  const ft = tokenize(f);
  if (at.some((w) => ft.includes(w))) return true;
  const synonyms = CATEGORY_SYNONYMS[f];
  if (synonyms && synonyms.some((s) => a.includes(s))) return true;
  return false;
}

function runSearch(query: MockRequest['query'] = {}): SearchResponse {
  const q = (query.query !== undefined ? String(query.query) : '').trim();
  const category = query.category !== undefined ? String(query.category) : '';
  const minPrice = asNumber(query.minPrice);
  const maxPrice = asNumber(query.maxPrice);
  const minQty = asNumber(query.minQty);
  const page = Math.max(1, asNumber(query.page) ?? 1);
  const pageSize = Math.max(1, asNumber(query.pageSize) ?? 20);

  let scored = PRODUCTS.map((product) => ({ product, score: relevanceScore(product, q) }));

  if (q) scored = scored.filter((s) => s.score > 0);
  if (category) scored = scored.filter((s) => categoryMatches(s.product.category, category));
  if (minPrice !== undefined) scored = scored.filter((s) => s.product.basePrice >= minPrice);
  if (maxPrice !== undefined) scored = scored.filter((s) => s.product.basePrice <= maxPrice);
  if (minQty !== undefined) {
    scored = scored.filter((s) => (s.product.sellableQty ?? s.product.stock) >= minQty);
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const ratingDiff = (b.product.averageRating ?? 0) - (a.product.averageRating ?? 0);
    if (ratingDiff !== 0) return ratingDiff;
    return a.product.name.localeCompare(b.product.name);
  });

  const total = scored.length;
  const start = (page - 1) * pageSize;
  const items = scored.slice(start, start + pageSize).map((s) => s.product);
  return { items, total, page, pageSize };
}

// ---------------------------------------------------------------------------
// Supplier context resolution
// ---------------------------------------------------------------------------

function supplierProductsFor(supplierId: string, query: MockRequest['query'] = {}): Paginated<Product> {
  const page = Math.max(1, asNumber(query.page) ?? 1);
  const pageSize = Math.max(1, asNumber(query.pageSize) ?? 20);
  const all = PRODUCTS.filter((p) => p.supplierId === supplierId);
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length, page, pageSize };
}

// ---------------------------------------------------------------------------
// Path routing
// ---------------------------------------------------------------------------

function normalizePath(path: string): string[] {
  const clean = path.split('?')[0]!.replace(/^\/+|\/+$/g, '');
  return clean ? clean.split('/') : [];
}

/**
 * Resolve a mock API request. Returns the typed body or throws {@link ApiError}.
 */
export async function mockResolve<T>(path: string, options: MockRequest = {}): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const seg = normalizePath(path);
  const [s0, s1, s2, s3] = seg;
  const query = options.query;
  const body = (options.body ?? {}) as Record<string, unknown>;

  // ---- Auth ----
  if (s0 === 'auth') {
    if (s1 === 'login' && method === 'POST') {
      const email = String((body.email as string) ?? '').trim();
      if (!email) throw apiError(400, 'VALIDATION', 'Email is required');
      const role = roleForEmail(email);
      const user = buildSessionUser(email, role);
      return {
        accessToken: encodeToken(user),
        refreshToken: `mockrefresh.${toBase64(user.id)}`,
        user,
      } as T;
    }
    if (s1 === 'register' && method === 'POST') {
      const email = String((body.email as string) ?? '').trim();
      if (!email) throw apiError(400, 'VALIDATION', 'Email is required');
      const role = (body.role as SessionUser['role']) ?? roleForEmail(email);
      const user = buildSessionUser(email, role, (body.businessName as string) || undefined);
      return { user } as T;
    }
    if (s1 === 'logout' && method === 'POST') {
      return ok() as T;
    }
    if (s1 === 'me' && method === 'GET') {
      const user = decodeToken(options.token);
      if (!user) throw apiError(401, 'UNAUTHORIZED', 'Session is invalid or expired');
      return { user } as T;
    }
    // Admin user moderation: /auth/admin/users/:id/suspend
    if (s1 === 'admin' && s2 === 'users' && method === 'POST') {
      return ok({ userId: seg[3], action: seg[4] ?? 'suspend' }) as T;
    }
  }

  // ---- Search ----
  if (s0 === 'search' && method === 'GET' && seg.length === 1) {
    return runSearch(query) as unknown as T;
  }

  // ---- Products ----
  if (s0 === 'products') {
    if (method === 'POST' && seg.length === 1) {
      return ok({ id: `p-new-${Date.now().toString(36)}`, status: 'DRAFT' }) as T;
    }
    if (s1 && seg.length === 2 && method === 'GET') {
      const product = productById(s1);
      if (!product) throw notFound('Product');
      return product as unknown as T;
    }
    if (s1 && s2 && method === 'POST') {
      // /products/:id/tiers | publish | unpublish | reviews
      if (s2 === 'tiers') return ok({ productId: s1, tiers: body.tiers ?? [] }) as T;
      if (s2 === 'publish') return ok({ productId: s1, status: 'PUBLISHED' }) as T;
      if (s2 === 'unpublish') return ok({ productId: s1, status: 'UNPUBLISHED' }) as T;
      if (s2 === 'reviews') {
        return ok({ id: `r-new-${Date.now().toString(36)}`, productId: s1, rating: body.rating, text: body.text }) as T;
      }
    }
    if (s1 && s2 === 'stock' && method === 'PUT') {
      return ok({ productId: s1, stock: body.stock }) as T;
    }
  }

  // ---- Cart ----
  if (s0 === 'cart') {
    if (seg.length === 1 && method === 'GET') {
      return buildCart() as unknown as T;
    }
    if (s1 === 'items') {
      if (seg.length === 2 && method === 'POST') {
        return ok({ productId: body.productId, quantity: body.quantity }) as T;
      }
      if (s2 && method === 'PUT') return ok({ itemId: s2, quantity: body.quantity }) as T;
      if (s2 && method === 'DELETE') return ok({ itemId: s2 }) as T;
    }
    if (s1 === 'reservations' && s2 && s3 === 'renew' && method === 'POST') {
      const expiresAt = new Date(Date.now() + 13 * 60 * 1000).toISOString();
      return ok({ reservationId: s2, reservationExpiresAt: expiresAt }) as T;
    }
  }

  // ---- Checkout + Payments ----
  if (s0 === 'checkout' && method === 'POST') {
    const cart = buildCart();
    const orderId = `${Date.now().toString(16)}-ord`;
    const subOrders = cart.groups.map((g, i) => ({ id: `${orderId}-${i + 1}`, status: 'CONFIRMED' }));
    return { orderId, subOrders } as T;
  }
  if (s0 === 'payments' && s1 === 'initiate' && method === 'POST') {
    // No checkoutUrl → the UI falls back to the in-app order page.
    return { txnId: `txn-${Date.now().toString(36)}` } as T;
  }

  // ---- Orders (retailer) ----
  if (s0 === 'orders') {
    if (seg.length === 1 && method === 'GET') {
      const items: OrderSummary[] = orderSummaries();
      const page = Math.max(1, asNumber(query?.page) ?? 1);
      const pageSize = Math.max(1, asNumber(query?.pageSize) ?? 10);
      const start = (page - 1) * pageSize;
      const paged: Paginated<OrderSummary> = {
        items: items.slice(start, start + pageSize),
        total: items.length,
        page,
        pageSize,
      };
      return paged as unknown as T;
    }
    if (s1 && seg.length === 2 && method === 'GET') {
      const order: Order | undefined = orderById(s1);
      if (!order) throw notFound('Order');
      return order as unknown as T;
    }
  }

  // ---- Sub-orders (supplier fulfilment actions) ----
  if (s0 === 'suborders' && s1 && s2 && method === 'POST') {
    const action = s2; // pack | ship | deliver | cancel
    const statusMap: Record<string, string> = {
      pack: 'PACKED',
      ship: 'SHIPPED',
      deliver: 'DELIVERED',
      cancel: 'CANCELLED',
    };
    return ok({ subOrderId: s1, status: statusMap[action] ?? 'CONFIRMED', trackingRef: body.trackingRef }) as T;
  }

  // ---- Suppliers (self) ----
  if (s0 === 'suppliers') {
    if (s1 === 'me') {
      const user = decodeToken(options.token);
      const profile = supplierProfileFor(DEMO_SUPPLIER_ID);
      if (seg.length === 2 && method === 'GET') {
        return { ...profile, businessName: user?.businessName ?? profile.businessName } as unknown as T;
      }
      if (s2 === 'products' && method === 'GET') {
        return supplierProductsFor(DEMO_SUPPLIER_ID, query) as unknown as T;
      }
      if (s2 === 'suborders' && method === 'GET') {
        return { items: SUPPLIER_SUBORDERS } as T;
      }
    }
    if (s1 === 'kyc' && method === 'POST') {
      return ok({ status: 'UNDER_REVIEW', businessName: body.businessName }) as T;
    }
  }

  // ---- Admin ----
  if (s0 === 'admin') {
    if (s1 === 'metrics' && method === 'GET') {
      return ADMIN_METRICS as unknown as T;
    }
    if (s1 === 'kyc' && method === 'GET') {
      return { items: KYC_SUBMISSIONS } as T;
    }
    if (s1 === 'suppliers' && s2 && s3 === 'kyc' && method === 'POST') {
      const decision = seg[4]; // approve | reject
      return ok({ supplierId: s2, status: decision === 'approve' ? 'VERIFIED' : 'REJECTED', reason: body.reason }) as T;
    }
    if (s1 === 'products' && s2 && seg[3] === 'remove' && method === 'POST') {
      return ok({ productId: s2, removed: true }) as T;
    }
    if (s1 === 'reviews' && s2 && method === 'DELETE') {
      return ok({ reviewId: s2, removed: true }) as T;
    }
  }

  throw notFound(`Mock route ${method} /${seg.join('/')}`);
}

// Re-export for convenience / potential direct use.
export { categorySlug };
