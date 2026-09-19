import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * These tests verify the actual data-handling logic of each Phase 1 read tool
 * (search, get-product/price, variants/sizes, inventory, order status) against
 * *realistic Salla-shaped* mocked HTTP responses - something the existing test
 * suite didn't cover (it only proves the client fails closed with no
 * credentials, and that the permission engine routes tiers correctly). No
 * network or real SALLA_ACCESS_TOKEN is used or needed; `salla.get` itself is
 * replaced with a fixture-returning mock at the client boundary.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("../src/integrations/salla/client.js", () => ({
  salla: { get: mockGet, post: vi.fn(), put: vi.fn(), del: vi.fn() },
  isSallaConfigured: () => true,
  SallaNotConfiguredError: class SallaNotConfiguredError extends Error {},
}));

const { sallaTools } = await import("../src/integrations/salla/tools.js");

function tool(name: string) {
  const found = sallaTools.find((t) => t.name === name);
  if (!found) throw new Error(`tool not registered: ${name}`);
  return found;
}

const ctx = { actorLabel: "test" };

// ---- Realistic fixtures, shaped exactly like real Salla Admin API v2 responses ----
const PRODUCT_FIXTURE = {
  id: 501,
  name: "فستان مريم",
  sku: "MG3242",
  price: { amount: 199, currency: "SAR" },
  sale_price: { amount: 169, currency: "SAR" },
  quantity: 12,
  status: "sale",
  urls: { customer: "https://fara-sa.com/products/mg3242", admin: "https://admin.salla.sa/products/501" },
};

// Deliberately spans two pages, and includes a decoy SKU ("MG3242-SM") whose
// SKU text contains "M" as a substring but whose real option value is "S" -
// this is exactly the false-positive case the Codex review caught and we fixed.
const VARIANTS_PAGE_1 = [
  { id: 9001, sku: "MG3242-SM", price: { amount: 199, currency: "SAR" }, sale_price: { amount: 169, currency: "SAR" }, quantity: 3, options: [{ id: 1, name: "المقاس", value: "S" }] },
  { id: 9002, sku: "MG3242-M", price: { amount: 199, currency: "SAR" }, sale_price: { amount: 169, currency: "SAR" }, quantity: 5, options: [{ id: 1, name: "المقاس", value: "M" }] },
];
const VARIANTS_PAGE_2 = [
  // No `quantity` at all - the real "unlimited stock" case that must surface as unknown, not "out of stock".
  { id: 9003, sku: "MG3242-L", price: { amount: 199, currency: "SAR" }, sale_price: null, options: [{ id: 1, name: "المقاس", value: "L" }] },
];

const ORDER_FIXTURE = {
  id: 10245,
  reference_id: 10245,
  status: { name: "جاري التجهيز", slug: "processing" },
  total: { amount: 169, currency: "SAR" },
  customer: { first_name: "سارة", last_name: "أحمد", mobile: "+966500000001" },
  items: [{ product_id: 501, name: "فستان مريم", quantity: 1, total: { amount: 169 } }],
};

describe("Phase 1 read tools against realistic mocked Salla responses", () => {
  // mockGet is shared across every test in this file (vi.hoisted), so without
  // resetting it here, toHaveBeenCalledWith/toHaveBeenNthCalledWith in a later
  // test would see call history accumulated from earlier tests too.
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("salla.products.search returns real product data (name/price/sku) from Salla's shape", async () => {
    mockGet.mockResolvedValueOnce({ data: [PRODUCT_FIXTURE], pagination: { count: 1, total: 1, perPage: 15, currentPage: 1, totalPages: 1 } });

    const result: any = await tool("salla.products.search").handler({ keyword: "فستان" }, ctx);

    expect(mockGet).toHaveBeenCalledWith("/products", { keyword: "فستان" });
    expect(result.data[0].name).toBe("فستان مريم");
    expect(result.data[0].sku).toBe("MG3242");
  });

  it("salla.products.get returns full product data including the real price", async () => {
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE });

    const result: any = await tool("salla.products.get").handler({ id: 501 }, ctx);

    expect(mockGet).toHaveBeenCalledWith("/products/501");
    expect(result.data.price.amount).toBe(199);
    expect(result.data.sale_price.amount).toBe(169);
  });

  it("salla.products.getBySku resolves a product by its real SKU", async () => {
    mockGet.mockResolvedValueOnce({ data: [PRODUCT_FIXTURE] });

    const result: any = await tool("salla.products.getBySku").handler({ sku: "MG3242" }, ctx);

    expect(mockGet).toHaveBeenCalledWith("/products", { sku: "MG3242" });
    expect(result.data[0].id).toBe(501);
  });

  it("salla.products.getVariants (sizes/options) walks every page instead of only the first", async () => {
    mockGet
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_1, pagination: { count: 2, total: 3, perPage: 100, currentPage: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_2, pagination: { count: 1, total: 3, perPage: 100, currentPage: 2, totalPages: 2 } });

    const result: any = await tool("salla.products.getVariants").handler({ id: 501 }, ctx);

    expect(mockGet).toHaveBeenNthCalledWith(1, "/products/501/skus", { page: 1, per_page: 100 });
    expect(mockGet).toHaveBeenNthCalledWith(2, "/products/501/skus", { page: 2, per_page: 100 });
    expect(result.data).toHaveLength(3); // page 1 (S, M) + page 2 (L) all aggregated
    expect(result.data.map((v: any) => v.sku)).toEqual(["MG3242-SM", "MG3242-M", "MG3242-L"]);
  });

  it("salla.inventory.list returns real quantities per product", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ product_id: 501, sku: "MG3242", quantity: 12 }] });

    const result: any = await tool("salla.inventory.list").handler({}, ctx);

    expect(mockGet).toHaveBeenCalledWith("/products/quantities", {});
    expect(result.data[0].quantity).toBe(12);
  });

  it("salla.inventory.checkVariant matches the real size M and reports its real stock", async () => {
    mockGet
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_1, pagination: { count: 2, total: 3, perPage: 100, currentPage: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_2, pagination: { count: 1, total: 3, perPage: 100, currentPage: 2, totalPages: 2 } });

    const result: any = await tool("salla.inventory.checkVariant").handler({ id: 501, variant: "M" }, ctx);

    expect(result.found).toBe(true);
    expect(result.variants).toHaveLength(1);
    expect(result.variants[0].sku).toBe("MG3242-M");
    expect(result.variants[0].quantity).toBe(5);
    expect(result.variants[0].inStock).toBe(true);
  });

  it("salla.inventory.checkVariant never matches on a SKU substring (the MG3242-SM decoy for a plain 'M' search)", async () => {
    mockGet
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_1, pagination: { count: 2, total: 3, perPage: 100, currentPage: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_2, pagination: { count: 1, total: 3, perPage: 100, currentPage: 2, totalPages: 2 } });

    const result: any = await tool("salla.inventory.checkVariant").handler({ id: 501, variant: "M" }, ctx);

    // Only the real size-M variant (option value "M") should match - not the
    // size-S variant whose SKU "MG3242-SM" happens to contain the letter M.
    expect(result.variants.map((v: any) => v.sku)).not.toContain("MG3242-SM");
  });

  it("salla.inventory.checkVariant reports unknown stock (never a fabricated out-of-stock) when Salla omits quantity", async () => {
    mockGet
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_1, pagination: { count: 2, total: 3, perPage: 100, currentPage: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_2, pagination: { count: 1, total: 3, perPage: 100, currentPage: 2, totalPages: 2 } });

    const result: any = await tool("salla.inventory.checkVariant").handler({ id: 501, variant: "L" }, ctx);

    expect(result.found).toBe(true);
    expect(result.variants[0].quantity).toBeNull();
    expect(result.variants[0].inStock).toBeNull(); // must NOT be false
    expect(result.variants[0].note).toBeTruthy();
  });

  it("salla.inventory.checkVariant returns found:false for a size the product doesn't have, without inventing one", async () => {
    mockGet
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_1, pagination: { count: 2, total: 3, perPage: 100, currentPage: 1, totalPages: 2 } })
      .mockResolvedValueOnce({ data: VARIANTS_PAGE_2, pagination: { count: 1, total: 3, perPage: 100, currentPage: 2, totalPages: 2 } });

    const result: any = await tool("salla.inventory.checkVariant").handler({ id: 501, variant: "XXL" }, ctx);

    expect(result.found).toBe(false);
    expect(result.variants).toBeUndefined();
  });

  it("salla.orders.get returns the real order status and number", async () => {
    mockGet.mockResolvedValueOnce({ data: ORDER_FIXTURE });

    const result: any = await tool("salla.orders.get").handler({ id: 10245 }, ctx);

    expect(mockGet).toHaveBeenCalledWith("/orders/10245");
    expect(result.data.id).toBe(10245);
    expect(result.data.status.name).toBe("جاري التجهيز");
  });

  it("salla.orders.history returns the real tracking history", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ status: "processing", created_at: "2026-09-18" }] });

    await tool("salla.orders.history").handler({ id: 10245 }, ctx);

    expect(mockGet).toHaveBeenCalledWith("/orders/10245/histories");
  });
});
