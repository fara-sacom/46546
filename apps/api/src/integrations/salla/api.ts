import { salla } from "./client.js";

// ---- Types (partial - only fields FARA agent relies on) ----
export interface SallaProduct {
  id: number;
  name: string;
  sku?: string | null;
  price?: { amount: number; currency: string };
  sale_price?: { amount: number; currency: string } | null;
  quantity?: number | null;
  status?: string;
  urls?: { customer?: string; admin?: string };
  options?: unknown[];
  [k: string]: unknown;
}

export interface SallaOrder {
  id: number;
  reference_id?: number;
  status?: { name?: string; slug?: string };
  total?: { amount: number; currency: string };
  customer?: { first_name?: string; last_name?: string; mobile?: string };
  created_at?: unknown;
  items?: Array<{ product_id?: number; name?: string; quantity?: number; total?: { amount: number } }>;
  [k: string]: unknown;
}

export interface SallaCustomer {
  id: number;
  first_name?: string;
  last_name?: string;
  email?: string;
  mobile?: string;
  [k: string]: unknown;
}

interface Paginated<T> {
  data: T[];
  pagination?: { count: number; total: number; perPage: number; currentPage: number; totalPages: number };
}

// ---- Products ----
export const products = {
  list: (params: { page?: number; per_page?: number; keyword?: string; status?: string } = {}) =>
    salla.get<Paginated<SallaProduct>>("/products", params),

  get: (id: number) => salla.get<{ data: SallaProduct }>(`/products/${id}`),

  search: (keyword: string, params: { page?: number; per_page?: number } = {}) =>
    salla.get<Paginated<SallaProduct>>("/products", { ...params, keyword }),

  getBySku: (sku: string) => salla.get<Paginated<SallaProduct>>("/products", { sku }),

  create: (payload: Record<string, unknown>) => salla.post<{ data: SallaProduct }>("/products", payload),

  update: (id: number, payload: Record<string, unknown>) =>
    salla.put<{ data: SallaProduct }>(`/products/${id}`, payload),

  addImage: (id: number, payload: { image: string; alt?: string; sort?: number }) =>
    salla.post(`/products/${id}/images`, payload),
};

// ---- Inventory ----
export const inventory = {
  list: (params: { page?: number; per_page?: number } = {}) =>
    salla.get<Paginated<{ product_id: number; sku?: string; quantity: number }>>("/products/quantities", params),

  update: (productId: number, quantity: number) =>
    salla.put(`/products/${productId}/quantity`, { quantity }),
};

// ---- Orders ----
export const orders = {
  list: (params: { page?: number; per_page?: number; status?: string; from?: string; to?: string } = {}) =>
    salla.get<Paginated<SallaOrder>>("/orders", params),

  get: (id: number) => salla.get<{ data: SallaOrder }>(`/orders/${id}`),

  statuses: () => salla.get<{ data: Array<{ id: number; name: string; slug: string }> }>("/orders/statuses"),

  history: (id: number) => salla.get(`/orders/${id}/histories`),

  updateStatus: (id: number, statusSlug: string, note?: string) =>
    salla.post(`/orders/${id}/status`, { slug: statusSlug, note }),

  addHistoryNote: (id: number, note: string) => salla.post(`/orders/${id}/histories`, { note }),
};

// ---- Customers ----
export const customers = {
  list: (params: { page?: number; per_page?: number; keyword?: string } = {}) =>
    salla.get<Paginated<SallaCustomer>>("/customers", params),

  get: (id: number) => salla.get<{ data: SallaCustomer }>(`/customers/${id}`),
};

// ---- Categories / reviews / abandoned carts ----
export const categories = {
  list: (params: { page?: number; per_page?: number } = {}) => salla.get<Paginated<unknown>>("/categories", params),
};

export const reviews = {
  list: (params: { page?: number; per_page?: number; product_id?: number } = {}) =>
    salla.get<Paginated<unknown>>("/reviews", params),
};

export const abandonedCarts = {
  list: (params: { page?: number; per_page?: number } = {}) =>
    salla.get<Paginated<unknown>>("/carts/abandoned", params),
};

// ---- Store pages / theme (used sparingly, all ACTION tier) ----
export const storePages = {
  listHomepageComponents: () => salla.get("/home/blocks"),
  listLandingPages: (params: { page?: number } = {}) => salla.get("/landing-pages", params),
  listMenus: () => salla.get("/menus"),
};

// ---- Branding & theme (for the Design assistant). NOTE: Salla's public
// Admin API v2 reference does not list a single canonical path for these two
// resources the way it does for /products or /orders - these paths follow
// Salla's own naming convention and should be double-checked against
// https://docs.salla.dev/ before relying on them in production. ----
export const brandingAndTheme = {
  getBranding: () => salla.get("/store/branding"),
  updateBranding: (payload: Record<string, unknown>) => salla.put("/store/branding", payload),
  getThemeSettings: () => salla.get("/store/theme/settings"),
  updateThemeSettings: (payload: Record<string, unknown>) => salla.put("/store/theme/settings", payload),
};

// ---- Computed analytics (built from documented endpoints; Salla's public
// Admin API v2 has no dedicated "reports" resource, so FARA computes these
// directly from real orders/products data rather than guessing an
// undocumented internal endpoint). ----
export const analytics = {
  /** Aggregates the most recent `sampleSize` orders into a sales summary. */
  async salesSummary(params: { from?: string; to?: string; sampleSize?: number } = {}) {
    const perPage = 100;
    const sampleSize = params.sampleSize ?? 200;
    let page = 1;
    let totalAmount = 0;
    let currency = "SAR";
    let count = 0;
    const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>();

    while (count < sampleSize) {
      const res = await orders.list({ page, per_page: perPage, from: params.from, to: params.to });
      const batch = res.data ?? [];
      if (batch.length === 0) break;
      for (const order of batch) {
        if (order.total?.amount) {
          totalAmount += order.total.amount;
          currency = order.total.currency ?? currency;
        }
        for (const item of order.items ?? []) {
          const key = String(item.product_id ?? item.name ?? "unknown");
          const entry = byProduct.get(key) ?? { name: item.name ?? key, quantity: 0, revenue: 0 };
          entry.quantity += item.quantity ?? 0;
          entry.revenue += item.total?.amount ?? 0;
          byProduct.set(key, entry);
        }
        count++;
        if (count >= sampleSize) break;
      }
      if (!res.pagination || page >= (res.pagination.totalPages ?? 1)) break;
      page++;
    }

    const topProducts = [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    return {
      ordersSampled: count,
      totalAmount,
      currency,
      averageOrderValue: count > 0 ? Number((totalAmount / count).toFixed(2)) : 0,
      topProductsByQuantity: topProducts,
      note: "محسوبة من عيّنة الطلبات الأخيرة عبر Salla Admin API (لا يوجد endpoint تقارير رسمي عام في هذه النسخة).",
    };
  },

  async lowStockProducts(threshold = 5, sampleSize = 300) {
    const perPage = 100;
    let page = 1;
    const low: Array<{ id: number; name: string; sku?: string | null; quantity: number }> = [];
    let scanned = 0;
    while (scanned < sampleSize) {
      const res = await products.list({ page, per_page: perPage });
      const batch = res.data ?? [];
      if (batch.length === 0) break;
      for (const p of batch) {
        scanned++;
        if (typeof p.quantity === "number" && p.quantity <= threshold) {
          low.push({ id: p.id, name: p.name, sku: p.sku, quantity: p.quantity });
        }
      }
      if (!res.pagination || page >= (res.pagination.totalPages ?? 1)) break;
      page++;
    }
    return { threshold, scanned, lowStockProducts: low };
  },
};
