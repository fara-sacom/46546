import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * What this proves vs. what it can't:
 *
 * PROVES (real code, really executed): the plumbing behind "the customer asks
 * about a product, then asks 'do you have size M?' and FARA understands she
 * means that same product" - i.e. that runAgentTurn actually reloads the full
 * prior conversation text AND the CustomerContext memory note on the very
 * next turn, and hands both to Claude. That's testable without a live model:
 * we control exactly what the mocked Anthropic client receives and assert on
 * the `system` string and `messages` array of the *second* turn's request.
 *
 * CANNOT PROVE: that the real Claude model will correctly resolve "M" to the
 * right product id given that context. That's the model's own reasoning at
 * call time, not something this codebase's tests can certify without an
 * actual ANTHROPIC_API_KEY and a live API call. Turn 2's tool choice below is
 * SCRIPTED (we tell the mock what to return) to represent the desired
 * behavior, not something the test discovered on its own.
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

// Must be set before the first import of env.js (transitively via core.js),
// so use a dynamic import below instead of a static one at the top of the file.
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

const VARIANT_M_FIXTURE = [
  { id: 9002, sku: "MG3242-M", price: { amount: 199, currency: "SAR" }, sale_price: { amount: 169, currency: "SAR" }, quantity: 5, options: [{ id: 1, name: "المقاس", value: "M" }] },
];

function textBlock(text: string) {
  return { type: "text" as const, text };
}
function toolUseBlock(id: string, name: string, input: unknown) {
  return { type: "tool_use" as const, id, name, input };
}

describe("cross-turn conversation context actually reaches the model", () => {
  beforeAll(async () => {
    await syncToolRegistry();
  });

  beforeEach(() => {
    mockCreate.mockReset();
    mockSallaGet.mockReset();
  });

  it("turn 2 ('هل عندكم مقاس M؟') receives turn 1's full text history AND the CustomerContext memory note", async () => {
    const conversation = await prisma.conversation.create({
      data: { channel: "WHATSAPP", customerRef: "+966500000009", language: "ar" },
    });

    // ---- Turn 1: "عندكم فستان MG3242؟" ----
    mockSallaGet.mockResolvedValueOnce({ data: [PRODUCT_FIXTURE] }); // salla.products.getBySku
    mockCreate
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu1", "salla.products.getBySku", { sku: "MG3242" })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu2", "memory.updateCustomerContext", {
          currentIntent: "product_price",
          lastProduct: { productId: 501, name: "فستان مريم", sku: "MG3242" },
        })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [textBlock("حياكِ الله 🤍 فستان مريم (MG3242) متوفر بسعر 169 ريال")],
        stop_reason: "end_turn",
      });

    const turn1 = await runAgentTurn(conversation.id, "عندكم فستان MG3242؟", { actorLabel: "Customer via WhatsApp" });
    expect(turn1.reply).toContain("فستان مريم");

    const memoryAfterTurn1 = await prisma.customerContext.findUnique({ where: { whatsappNumber: "+966500000009" } });
    expect(memoryAfterTurn1?.lastProduct).toContain("فستان مريم");

    // ---- Turn 2: "هل عندكم مقاس M؟" - a NEW runAgentTurn call, fresh history reload from DB ----
    // mockCreate is NOT reset between turn 1 and turn 2 (only between separate
    // `it()` blocks) - its call history accumulates, so we must record the
    // index turn 2 starts at rather than assume calls[0] is turn 2's first call.
    const callsBeforeTurn2 = mockCreate.mock.calls.length;
    mockSallaGet.mockResolvedValueOnce({ data: VARIANT_M_FIXTURE }); // salla.products.getVariants (inside checkVariant)
    mockCreate
      .mockResolvedValueOnce({
        // SCRIPTED: this productId (501) is asserted as the desired resolution,
        // not something this test proves the real model will produce.
        content: [toolUseBlock("tu3", "salla.inventory.checkVariant", { id: 501, variant: "M" })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [textBlock("نعم متوفر مقاس M 🤍")],
        stop_reason: "end_turn",
      });

    const turn2 = await runAgentTurn(conversation.id, "هل عندكم مقاس M؟", { actorLabel: "Customer via WhatsApp" });
    expect(turn2.reply).toContain("M");

    // The FIRST messages.create() call of turn 2 is what matters here.
    const turn2FirstCallArgs = mockCreate.mock.calls[callsBeforeTurn2][0];

    // Proof 1: turn 1's real text (both the customer's question and FARA's own
    // reply naming the product) is present in the history handed to the model.
    const historyText = JSON.stringify(turn2FirstCallArgs.messages);
    expect(historyText).toContain("عندكم فستان MG3242؟");
    expect(historyText).toContain("فستان مريم");

    // Proof 2: the CustomerContext memory note (built from what turn 1 stored)
    // is actually appended to the system prompt for turn 2, not just written
    // to the DB and never used again.
    expect(turn2FirstCallArgs.system).toContain("سياق سابق لهذه العميلة");
    expect(turn2FirstCallArgs.system).toContain("فستان مريم");

    // Proof 3: given that context, the (scripted) tool call actually hit Salla
    // for the SAME product id (501) resolved in turn 1 - the concrete outcome
    // this scenario is about. Still scripted (see note above), but confirms
    // the plumbing from a correct model decision through to the right Salla
    // call works, which is the part this codebase's own code is responsible for.
    expect(mockSallaGet).toHaveBeenLastCalledWith("/products/501/skus", { page: 1, per_page: 100 });
  });

  it("passes an empty Salla result through to the model honestly - our code never substitutes fabricated data", async () => {
    // This test verifies what our OWN code is responsible for: that a real
    // "not found" result from Salla reaches Claude as exactly that, with
    // nothing invented anywhere in the pipeline. It does NOT test that the
    // model will phrase a good reply from it - that's the model's job, and
    // the second mockCreate response below is scripted, not verified.
    const conversation = await prisma.conversation.create({
      data: { channel: "WHATSAPP", customerRef: "+966500000010", language: "ar" },
    });

    mockSallaGet.mockResolvedValueOnce({ data: [] }); // Salla genuinely found no product for this SKU
    mockCreate
      .mockResolvedValueOnce({
        content: [toolUseBlock("tu1", "salla.products.getBySku", { sku: "DOES-NOT-EXIST" })],
        stop_reason: "tool_use",
      })
      .mockResolvedValueOnce({
        content: [textBlock("ما لقيت هذا المنتج بالكود اللي ذكرتيه، ممكن تتأكدين من رقم المنتج؟")],
        stop_reason: "end_turn",
      });

    await runAgentTurn(conversation.id, "عندكم منتج كود DOES-NOT-EXIST؟", { actorLabel: "Customer via WhatsApp" });

    // The tool_result block sent back to the model for round 2 - this is the
    // real, code-produced content, not something we asserted a reply against.
    const round2Args = mockCreate.mock.calls[1][0];
    const toolResultMessage = round2Args.messages.at(-1);
    expect(toolResultMessage.role).toBe("user");
    const toolResultContent = toolResultMessage.content[0].content;
    expect(JSON.parse(toolResultContent)).toEqual({ data: [] });
    // Specifically: no fallback product object, no default price, nothing
    // invented in place of the empty result.
    expect(toolResultContent).not.toMatch(/price|quantity|sale_price/);
  });
});
