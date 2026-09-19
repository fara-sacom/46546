import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 4, full flow: product selection -> confirm product -> size/quantity
 * -> real price/stock check -> order summary -> explicit customer
 * confirmation -> only then does the draft move to "confirmed". Two separate
 * runAgentTurn calls (two real WhatsApp messages), same as a real
 * conversation - this is what surfaced the draftId-across-turns gap fixed in
 * this same commit (confirmDraft's draftId is now optional, falling back to
 * "the most recent open draft for this conversation", since only the
 * agent's own final text - never raw tool_result JSON - persists across
 * turns; see agent/core.ts).
 *
 * As with the other conversation tests: what's PROVEN here is that the code
 * correctly builds the draft, re-verifies it at confirm time, and gates the
 * status transition on an explicit tool call. What's SCRIPTED (not proven)
 * is that the real Claude model will choose these exact tool calls given
 * the customer's messages - that needs a live API call to confirm.
 */
const { mockCreate, mockSallaGet } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockSallaGet: vi.fn(),
}));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

vi.mock("../src/integrations/salla/client.js", () => ({
  salla: { get: mockSallaGet, post: vi.fn(), put: vi.fn(), del: vi.fn() },
  isSallaConfigured: () => true,
  SallaNotConfiguredError: class SallaNotConfiguredError extends Error {},
}));

process.env.ANTHROPIC_API_KEY = "test-key-not-real";

const { prisma } = await import("../src/db.js");
const { runAgentTurn } = await import("../src/agent/core.js");
const { syncToolRegistry } = await import("../src/agent/toolRegistry.js");

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

function textBlock(text: string) {
  return { type: "text" as const, text };
}
function toolUseBlock(id: string, name: string, input: unknown) {
  return { type: "tool_use" as const, id, name, input };
}

describe("full order flow: selection -> real price/stock check -> summary -> explicit confirmation", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockSallaGet.mockReset();
  });

  it("does not confirm the order until the customer explicitly says yes in a LATER message", async () => {
    await syncToolRegistry();
    const conversation = await prisma.conversation.create({
      data: { channel: "WHATSAPP", customerRef: "+966500000011", language: "ar" },
    });

    // ---- Turn 1: "أبغى فستان MG3242 مقاس M حبة وحدة" ----
    mockSallaGet
      .mockResolvedValueOnce({ data: [PRODUCT_FIXTURE] }) // salla.products.getBySku
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE }) // resolveOrderItem's products.get inside prepareDraft
      .mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK }); // resolveOrderItem's products.getVariants
    mockCreate
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu1", "salla.products.getBySku", { sku: "MG3242" })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu2", "salla.orders.prepareDraft", { items: [{ productId: 501, variant: "M", quantity: 1 }] })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [textBlock("ملخص طلبك: فستان مريم مقاس M، السعر 169 ريال. تحبين أأكد الطلب؟")],
        stop_reason: "end_turn",
      });

    const turn1 = await runAgentTurn(conversation.id, "أبغى فستان MG3242 مقاس M حبة وحدة", { actorLabel: "Customer via WhatsApp" });
    expect(turn1.reply).toContain("تحبين أأكد");

    // Nothing is confirmed yet - this is the core "don't create/confirm before
    // explicit approval" requirement, checked at the DB level, not just prose.
    const draftsAfterTurn1 = await prisma.orderDraft.findMany({ where: { conversationId: conversation.id } });
    expect(draftsAfterTurn1).toHaveLength(1);
    expect(draftsAfterTurn1[0].status).toBe("draft"); // NOT "confirmed"

    // ---- Turn 2: "نعم أكدي" - a separate, later WhatsApp message ----
    mockSallaGet
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE }) // confirmDraft's re-check: products.get
      .mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK }); // confirmDraft's re-check: products.getVariants
    mockCreate
      .mockResolvedValueOnce({
        // No draftId passed - the model has no reliable way to recall the raw
        // internal id from turn 1 (only plain text persists across turns).
        content: [toolUseBlock("tu3", "salla.orders.confirmDraft", {})],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [textBlock("تم تأكيد طلبك 🤍 سيتواصل معك فريق المبيعات لإتمامه")],
        stop_reason: "end_turn",
      });

    const turn2 = await runAgentTurn(conversation.id, "نعم أكدي", { actorLabel: "Customer via WhatsApp" });
    expect(turn2.reply).toContain("تم تأكيد");

    const draftsAfterTurn2 = await prisma.orderDraft.findMany({ where: { conversationId: conversation.id } });
    expect(draftsAfterTurn2).toHaveLength(1); // same draft, not a duplicate
    expect(draftsAfterTurn2[0].status).toBe("confirmed");

    // Still never touched Salla's write endpoints - no real order was created.
    const { salla } = await import("../src/integrations/salla/client.js");
    expect(salla.post).not.toHaveBeenCalled();
    expect(salla.put).not.toHaveBeenCalled();
  });

  it("refuses to confirm (and tells the truth) if stock ran out between the summary and the customer's 'yes'", async () => {
    await syncToolRegistry();
    const conversation = await prisma.conversation.create({
      data: { channel: "WHATSAPP", customerRef: "+966500000012", language: "ar" },
    });

    mockSallaGet
      .mockResolvedValueOnce({ data: [PRODUCT_FIXTURE] })
      .mockResolvedValueOnce({ data: PRODUCT_FIXTURE })
      .mockResolvedValueOnce({ data: VARIANT_M_IN_STOCK });
    mockCreate
      .mockResolvedValueOnce({ content: [toolUseBlock("tu1", "salla.products.getBySku", { sku: "MG3242" })], stop_reason: "tool_use" })
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu2", "salla.orders.prepareDraft", { items: [{ productId: 501, variant: "M", quantity: 1 }] })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({ content: [textBlock("ملخص طلبك جاهز، تؤكدين؟")], stop_reason: "end_turn" });

    await runAgentTurn(conversation.id, "أبغى فستان MG3242 مقاس M", { actorLabel: "Customer via WhatsApp" });

    // Stock sold out in the meantime - the size no longer exists among real variants.
    mockSallaGet.mockResolvedValueOnce({ data: PRODUCT_FIXTURE }).mockResolvedValueOnce({ data: [] });
    mockCreate
      .mockResolvedValueOnce({ content: [toolUseBlock("tu3", "salla.orders.confirmDraft", {})], stop_reason: "tool_use" })
      .mockResolvedValueOnce({
        content: [textBlock("عذرًا 🤍 المقاس M نفد قبل ما نأكد طلبك، أبغى أعرض عليك مقاس ثاني؟")],
        stop_reason: "end_turn",
      });

    const turn2 = await runAgentTurn(conversation.id, "نعم أكدي", { actorLabel: "Customer via WhatsApp" });

    expect(turn2.reply).toMatch(/نفد|عذرًا/);
    const draft = await prisma.orderDraft.findFirst({ where: { conversationId: conversation.id } });
    expect(draft?.status).toBe("draft"); // never moved to confirmed on stale/invalid data
  });
});
