import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 5: salla.orders.requestExecution (ACTION) is the closest this system
 * can get to "creating the order" - because Salla itself has NO order/cart/
 * checkout creation endpoint for merchant apps (confirmed against the real,
 * credentialed s_salla_sa Salla tool set: only orders_list/get/status_update/
 * history_add/invoices exist for orders - no create). So "execution" here
 * means: re-verify real price/stock one more time at ADMIN-approval time,
 * then hand a complete data package to the sales team to place the order
 * themselves in Salla, and record the REAL resulting order id afterward via
 * the new POST /api/order-drafts/:id/record-salla-order route. Nothing in
 * this file, or in the product code, ever calls a Salla write endpoint for
 * orders.
 */
const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock("../src/integrations/salla/client.js", () => ({
  salla: { get: mockGet, post: vi.fn(), put: vi.fn(), del: vi.fn() },
  isSallaConfigured: () => true,
  SallaNotConfiguredError: class SallaNotConfiguredError extends Error {},
}));

const { sallaTools } = await import("../src/integrations/salla/tools.js");
const { prisma } = await import("../src/db.js");
const { syncToolRegistry } = await import("../src/agent/toolRegistry.js");
const { routeToolCall } = await import("../src/agent/router.js");
const { approveAction } = await import("../src/approvals/service.js");
const { createApp } = await import("../src/index.js");
const { hashApiKey } = await import("../src/middleware/auth.js");

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

async function buildConfirmedDraft(conversationId?: string) {
  mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
  const draft: any = await tool("salla.orders.prepareDraft").handler(
    { items: [{ productId: 501, variant: "M", quantity: 1 }], conversationId },
    ctx
  );

  mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
  await tool("salla.orders.confirmDraft").handler({ draftId: draft.draftId }, { ...ctx, conversationId });
  return draft.draftId as string;
}

describe("salla.orders.requestExecution (ACTION) - re-verifies at approval time, never creates a real order", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("succeeds and moves the draft to readyForPlacement when price/stock are unchanged at approval time", async () => {
    const draftId = await buildConfirmedDraft();

    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    const result: any = await tool("salla.orders.requestExecution").handler({ draftId }, ctx);

    expect(result.readyForPlacement).toBe(true);
    expect(result.status).toBe("readyForPlacement");
    const stored = await prisma.orderDraft.findUnique({ where: { id: draftId } });
    expect(stored?.status).toBe("readyForPlacement");
  });

  it("throws (blocking execution) and marks the draft executionBlocked if price changed since confirmation", async () => {
    const draftId = await buildConfirmedDraft();

    const priceIncreased = { ...VARIANT_M_IN_STOCK[0], sale_price: { amount: 199, currency: "SAR" } };
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: [priceIncreased] });

    await expect(tool("salla.orders.requestExecution").handler({ draftId }, ctx)).rejects.toThrow(/تغيّر/);

    const stored = await prisma.orderDraft.findUnique({ where: { id: draftId } });
    expect(stored?.status).toBe("executionBlocked");
    expect(stored?.executionBlockedReason).toBeTruthy();
  });

  it("refuses a draft that hasn't been through confirmDraft yet (status still 'draft')", async () => {
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    const draft: any = await tool("salla.orders.prepareDraft").handler({ items: [{ productId: 501, variant: "M", quantity: 1 }] }, ctx);

    await expect(tool("salla.orders.requestExecution").handler({ draftId: draft.draftId }, ctx)).rejects.toThrow(/confirmed/);
  });

  it("never calls a Salla write endpoint, even on success", async () => {
    const draftId = await buildConfirmedDraft();
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    await tool("salla.orders.requestExecution").handler({ draftId }, ctx);

    const { salla } = await import("../src/integrations/salla/client.js");
    expect(salla.post).not.toHaveBeenCalled();
    expect(salla.put).not.toHaveBeenCalled();
  });
});

describe("the ACTION gate actually blocks requestExecution until ADMIN approval", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("routeToolCall never runs the handler directly - it only creates a PENDING AgentAction", async () => {
    await syncToolRegistry();
    const draftId = await buildConfirmedDraft();

    const result = await routeToolCall("salla.orders.requestExecution", { draftId }, ctx);

    expect(result.status).toBe("pending_approval");
    expect(result.tier).toBe("ACTION");
    // Nothing was re-checked or transitioned yet - no mockGet calls consumed by the (unrun) handler.
    const stored = await prisma.orderDraft.findUnique({ where: { id: draftId } });
    expect(stored?.status).toBe("confirmed");
  });

  it("approveAction runs the real handler and only THEN moves the draft to readyForPlacement", async () => {
    await syncToolRegistry();
    const draftId = await buildConfirmedDraft();
    const staff = await prisma.staffUser.create({
      data: { name: "Admin", email: `admin-${draftId}@fara.test`, role: "ADMIN", apiKeyHash: `hash-${draftId}` },
    });

    const pending = await routeToolCall("salla.orders.requestExecution", { draftId }, ctx);
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    const decided = await approveAction(pending.actionId!, staff.id);

    expect(decided.status).toBe("EXECUTED");
    const stored = await prisma.orderDraft.findUnique({ where: { id: draftId } });
    expect(stored?.status).toBe("readyForPlacement");
  });

  it("approveAction marks the action FAILED (not EXECUTED) when stock ran out before approval", async () => {
    await syncToolRegistry();
    const draftId = await buildConfirmedDraft();
    const staff = await prisma.staffUser.create({
      data: { name: "Admin", email: `admin2-${draftId}@fara.test`, role: "ADMIN", apiKeyHash: `hash2-${draftId}` },
    });

    const pending = await routeToolCall("salla.orders.requestExecution", { draftId }, ctx);
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: [] }); // size M sold out
    const decided = await approveAction(pending.actionId!, staff.id);

    expect(decided.status).toBe("FAILED");
    const stored = await prisma.orderDraft.findUnique({ where: { id: draftId } });
    expect(stored?.status).toBe("executionBlocked");
  });
});

describe("salla.orders.checkDraftStatus - the only source of truth the agent may use before claiming success", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  it("reports sallaOrderId as null until staff actually records one - never invents a number", async () => {
    const draftId = await buildConfirmedDraft();
    const result: any = await tool("salla.orders.checkDraftStatus").handler({ draftId }, ctx);

    expect(result.found).toBe(true);
    expect(result.status).toBe("confirmed");
    expect(result.sallaOrderId).toBeNull();
  });
});

describe("POST /api/order-drafts/:id/record-salla-order - real HTTP route, staff-authenticated", () => {
  beforeEach(() => {
    mockGet.mockReset();
  });

  async function startServer() {
    const app = createApp();
    const server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const port = (server.address() as any).port;
    return { server, baseUrl: `http://127.0.0.1:${port}` };
  }

  it("rejects without a valid staff key", async () => {
    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/order-drafts/anything/record-salla-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sallaOrderId: 12345 }),
      });
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  it("rejects recording an order number on a draft that isn't readyForPlacement yet", async () => {
    const rawKey = "test-staff-key-1";
    await prisma.staffUser.create({
      data: { name: "Staff", email: `staff1-${Date.now()}@fara.test`, role: "OPERATOR", apiKeyHash: hashApiKey(rawKey) },
    });
    const draftId = await buildConfirmedDraft(); // status "confirmed", not "readyForPlacement"

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/order-drafts/${draftId}/record-salla-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-FARA-Staff-Key": rawKey },
        body: JSON.stringify({ sallaOrderId: 12345 }),
      });
      expect(res.status).toBe(409);
    } finally {
      server.close();
    }
  });

  it("records the real order id and moves the draft to 'placed' - the ONLY way this system reaches that status", async () => {
    const rawKey = "test-staff-key-2";
    await prisma.staffUser.create({
      data: { name: "Staff", email: `staff2-${Date.now()}@fara.test`, role: "OPERATOR", apiKeyHash: hashApiKey(rawKey) },
    });
    const draftId = await buildConfirmedDraft();
    mockGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    await tool("salla.orders.requestExecution").handler({ draftId }, ctx); // -> readyForPlacement

    const { server, baseUrl } = await startServer();
    try {
      const res = await fetch(`${baseUrl}/api/order-drafts/${draftId}/record-salla-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-FARA-Staff-Key": rawKey },
        body: JSON.stringify({ sallaOrderId: 987654, sallaReferenceId: 987654 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.draft.status).toBe("placed");
      expect(body.draft.sallaOrderId).toBe(987654);

      // Now, and only now, may the agent tell the customer a real order number exists.
      const finalStatus: any = await tool("salla.orders.checkDraftStatus").handler({ draftId }, ctx);
      expect(finalStatus.status).toBe("placed");
      expect(finalStatus.sallaOrderId).toBe(987654);
    } finally {
      server.close();
    }
  });
});
