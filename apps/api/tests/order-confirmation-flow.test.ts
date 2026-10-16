import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 4: verifies the confirmation gate itself - salla.orders.prepareDraft
 * builds a draft (status "draft"), and salla.orders.confirmDraft is the ONLY
 * path that moves it to "confirmed", re-checking real Salla price/stock at
 * that exact moment rather than trusting the snapshot taken when the draft
 * was first built. No real Salla order is ever created by either tool.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("../src/integrations/salla/client.js", () => ({
  salla: { get: mockGet, post: vi.fn(), put: vi.fn(), del: vi.fn() },
  isSallaConfigured: () => true,
  SallaNotConfiguredError: class SallaNotConfiguredError extends Error {},
}));

const { sallaTools } = await import("../src/integrations/salla/tools.js");
const { prisma } = await import("../src/db.js");

function tool(name: string) {
  const found = sallaTools.find((t) => t.name === name);
  if (!found) throw new Error(`tool not registered: ${name}`);
  return found;
}

const ctx = { actorLabel: "test" };

const PRODUCT_FIXTURE = {
  id: 501,
  name: "فستان مريم",
  sku: "MG3242",
  price: { amount: 199, currency: "SAR" },
  sale_price: { amount: 169, currency: "SAR" },
  quantity: 12,
  urls: { customer: "https://fara-sa.com/products/mg3242" },
};

const VARIANT_M_IN_STOCK = [
  { id: 9002, sku: "MG3242-M", price: { amount: 199, currency: "SAR" }, sale_price: { amount: 169, currency: "SAR" }, quantity: 5, options: [{ id: 1, name: "المقاس", value: "M" }] },
];

async function buildDraft() {
  mockGet
    .mockResolvedValueOnce({ data: PRODUCT_FIXTURE }) // products.get
    .mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK }); // products.getVariants

  const result: any = await tool("salla.orders.prepareDraft").handler(
    { items: [{ productId: 501, variant: "M", quantity: 1 }] },
    ctx
  );
  return result;
}

describe("order confirmation flow (prepareDraft -> explicit confirm -> confirmDraft)", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("prepareDraft creates a draft in 'draft' status - never auto-confirmed", async () => {
    const draft = await buildDraft();

    expect(draft.status).toBe("draft");
    expect(draft.estimatedTotal).toBe(169);
    const stored = await prisma.orderDraft.findUnique({ where: { id: draft.draftId } });
    expect(stored?.status).toBe("draft");
  });

  it("confirmDraft succeeds and transitions the draft to 'confirmed' when price/stock are unchanged", async () => {
    const draft = await buildDraft();

    mockGet
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE }) // re-check: products.get
      .mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK }); // re-check: products.getVariants, same as before

    const result: any = await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx);

    expect(result.confirmed).toBe(true);
    expect(result.status).toBe("confirmed");
    const stored = await prisma.orderDraft.findUnique({ where: { id: draft.draftId } });
    expect(stored?.status).toBe("confirmed");
  });

  it("confirmDraft REFUSES to confirm when the real price changed since the draft was built", async () => {
    const draft = await buildDraft();

    const priceIncreased = { ...VARIANT_M_IN_STOCK[0], sale_price: { amount: 199, currency: "SAR" } }; // price went up
    mockGet
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE })
      .mockResolvedValueOnce({ data: [priceIncreased] });

    const result: any = await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx);

    expect(result.confirmed).toBe(false);
    expect(result.reason).toMatch(/تغيّر/);
    expect(result.recheck[0].priceChangedSinceDraft).toBe(true);

    // Must NOT have moved forward - still "draft", not silently confirmed with stale data.
    const stored = await prisma.orderDraft.findUnique({ where: { id: draft.draftId } });
    expect(stored?.status).toBe("draft");
  });

  it("confirmDraft REFUSES to confirm when the size sold out since the draft was built", async () => {
    const draft = await buildDraft();

    mockGet
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE })
      .mockResolvedValueOnce({ data: [] }); // size M no longer exists among the real variants

    const result: any = await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx);

    expect(result.confirmed).toBe(false);
    expect(result.recheck[0].noLongerAvailable).toBe(true);
    const stored = await prisma.orderDraft.findUnique({ where: { id: draft.draftId } });
    expect(stored?.status).toBe("draft");
  });

  it("confirmDraft refuses a draft that isn't in 'draft' status (e.g. already confirmed)", async () => {
    const draft = await buildDraft();
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx); // first confirm succeeds

    const secondAttempt: any = await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx);

    expect(secondAttempt.confirmed).toBe(false);
    expect(secondAttempt.reason).toMatch(/confirmed/);
  });

  it("confirmDraft on a nonexistent draft id fails honestly instead of doing nothing silently", async () => {
    const result: any = await tool("salla.orders.confirmDraft").handler({ draftId: "does-not-exist" }, ctx);

    expect(result.confirmed).toBe(false);
    expect(result.reason).toMatch(/غير موجودة/);
  });

  it("neither prepareDraft nor confirmDraft ever calls a Salla write endpoint (post/put) - no real order, no inventory deduction", async () => {
    const { salla } = await import("../src/integrations/salla/client.js");
    const draft = await buildDraft();
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, ctx);

    expect(salla.post).not.toHaveBeenCalled();
    expect(salla.put).not.toHaveBeenCalled();
  });
});
