import 'server-only';
import { apiFetch } from './client';
import { apiFetchAuthed } from './server';
import type {
  AdminMetrics,
  Cart,
  KycSubmission,
  Order,
  OrderSummary,
  Paginated,
  Product,
  SearchResponse,
  SubOrder,
} from './types';

/**
 * Server-side data access. Each reader is wrapped so a missing/unreachable backend degrades to a
 * sensible empty value rather than crashing render (so `next build` and anonymous browsing work
 * without a live backend). Mutations live in server actions / route handlers and surface errors.
 */

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export interface SearchParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  minQty?: number;
  page?: number;
  pageSize?: number;
}

export async function searchProducts(params: SearchParams): Promise<SearchResponse> {
  const fallback: SearchResponse = {
    items: [],
    total: 0,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  };
  return safe(
    () =>
      apiFetch<SearchResponse>('/search', {
        query: {
          query: params.query,
          category: params.category,
          minPrice: params.minPrice,
          maxPrice: params.maxPrice,
          minQty: params.minQty,
          page: params.page,
          pageSize: params.pageSize,
        },
      }),
    fallback,
  );
}

export async function getProduct(id: string): Promise<Product | null> {
  return safe(() => apiFetchAuthed<Product>(`/products/${encodeURIComponent(id)}`), null);
}

export async function getCart(): Promise<Cart> {
  return safe(() => apiFetchAuthed<Cart>('/cart'), { groups: [], combinedTotal: 0 });
}

export async function getOrders(page = 1, pageSize = 10): Promise<Paginated<OrderSummary>> {
  return safe(() => apiFetchAuthed<Paginated<OrderSummary>>('/orders', { query: { page, pageSize } }), {
    items: [],
    total: 0,
    page,
    pageSize,
  });
}

export async function getOrder(id: string): Promise<Order | null> {
  return safe(() => apiFetchAuthed<Order>(`/orders/${encodeURIComponent(id)}`), null);
}

export async function getSupplierProducts(page = 1, pageSize = 20): Promise<Paginated<Product>> {
  return safe(
    () => apiFetchAuthed<Paginated<Product>>('/suppliers/me/products', { query: { page, pageSize } }),
    { items: [], total: 0, page, pageSize },
  );
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  return safe(() => apiFetchAuthed<AdminMetrics>('/admin/metrics'), {
    suppliers: 0,
    retailers: 0,
    products: 0,
    orders: 0,
  });
}

export async function getKycQueue(): Promise<KycSubmission[]> {
  return safe(
    () => apiFetchAuthed<{ items: KycSubmission[] }>('/admin/kyc').then((r) => r.items),
    [],
  );
}

export interface SupplierProfile {
  supplierId: string;
  businessName: string;
  verificationStatus: string;
}

export async function getSupplierProfile(): Promise<SupplierProfile | null> {
  return safe(() => apiFetchAuthed<SupplierProfile>('/suppliers/me'), null);
}

export async function getSupplierSubOrders(): Promise<SubOrder[]> {
  return safe(
    () => apiFetchAuthed<{ items: SubOrder[] }>('/suppliers/me/suborders').then((r) => r.items),
    [],
  );
}

export async function getSupplierProductWithTiers(id: string): Promise<Product | null> {
  return safe(() => apiFetchAuthed<Product>(`/products/${encodeURIComponent(id)}`), null);
}
