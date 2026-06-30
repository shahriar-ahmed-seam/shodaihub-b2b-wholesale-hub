/**
 * Shared domain types for the frontend, mirroring the BFF/Inventory/Auth API contracts and the
 * standard error envelope (design: Error Handling → Standard Error Envelope).
 */

export type Role = 'SUPPLIER' | 'RETAILER' | 'ADMINISTRATOR';

export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentProvider = 'bkash' | 'nagad' | 'sslcommerz';

/** Standard error envelope returned by every service. */
export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; issue: string }>;
    correlationId?: string;
  };
}

export interface SessionUser {
  id: string;
  email: string;
  businessName: string;
  role: Role;
  status: string;
  preferredLanguage?: string;
}

export interface PricingTier {
  minQty: number;
  maxQty: number;
  unitPrice: number;
}

export interface ProductReview {
  id: string;
  rating: number;
  text?: string;
  retailerName?: string;
  createdAt?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  category: string;
  basePrice: number;
  moq: number;
  stock: number;
  sellableQty?: number;
  status: string;
  supplierId: string;
  supplierName?: string;
  imageUrl?: string;
  /** Optional photographer attribution when the image comes from Unsplash. */
  imageCredit?: { name: string; url: string };
  tiers?: PricingTier[];
  averageRating?: number;
  reviewCount?: number;
  reviews?: ProductReview[];
}

export interface SearchResponse {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CartLineItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  reservationId: string;
  reservationExpiresAt: string;
  renewalCount: number;
  imageUrl?: string;
}

export interface CartSupplierGroup {
  supplierId: string;
  supplierName: string;
  items: CartLineItem[];
  subtotal: number;
}

export interface Cart {
  groups: CartSupplierGroup[];
  combinedTotal: number;
}

export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  imageUrl?: string;
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
}

export interface SubOrder {
  id: string;
  supplierId: string;
  supplierName: string;
  status: OrderStatus;
  total: number;
  lines: OrderLine[];
  trackingRef?: string;
  statusHistory?: StatusHistoryEntry[];
  lastUpdatedAt?: string;
}

export interface Order {
  id: string;
  total: number;
  placedAt: string;
  subOrders: SubOrder[];
}

export interface OrderSummary {
  id: string;
  total: number;
  placedAt: string;
  subOrderCount: number;
  latestStatus: OrderStatus;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminMetrics {
  suppliers: number;
  retailers: number;
  products: number;
  orders: number;
}

export interface KycSubmission {
  id: string;
  supplierId: string;
  businessName: string;
  tradeLicense: string;
  bankAccount: string;
  status: string;
  submittedAt?: string;
}
