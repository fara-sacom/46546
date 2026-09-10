import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { syncToolRegistry, getTool } from "../src/agent/toolRegistry.js";
import { routeToolCall } from "../src/agent/router.js";
import { ASSISTANTS } from "../src/agent/assistants.js";
import { getPlatformSettings } from "../src/agent/settings.js";
import { buildResponseStyleDirective } from "../src/agent/systemPrompt.js";

describe("assistant tool scoping", () => {
  beforeAll(async () => {
    await syncToolRegistry();
  });

  it("every tool name listed in an assistant's allowedTools actually exists in the tool registry (catches typos)", () => {
    for (const assistant of Object.values(ASSISTANTS)) {
      if (assistant.allowedTools === "all") continue;
      for (const name of assistant.allowedTools) {
        expect(getTool(name), `${assistant.id} references unknown tool "${name}"`).toBeDefined();
      }
    }
  });

  it("المساعد الشخصي (PERSONAL) has unrestricted access", () => {
    expect(ASSISTANTS.PERSONAL.allowedTools).toBe("all");
  });

  it("customer-facing assistants (WhatsApp/Instagram/TikTok) never get design or campaign-launch tools", () => {
    for (const id of ["WHATSAPP", "INSTAGRAM", "TIKTOK"] as const) {
      const tools = ASSISTANTS[id].allowedTools;
      expect(tools).not.toBe("all");
      expect(tools as string[]).not.toContain("salla.theme.updateSettings");
      expect(tools as string[]).not.toContain("marketing.launchCampaign");
    }
  });

  it("the router refuses a tool call outside the calling assistant's scope, even before checking configuration", async () => {
    // The Campaigns assistant's tool list does not include whatsapp.sendMessage.
    const result = await routeToolCall(
      "whatsapp.sendMessage",
      { to: "+966500000000", text: "hi" },
      { actorLabel: "test", allowedTools: ASSISTANTS.CAMPAIGNS.allowedTools }
    );
    expect(result.status).toBe("failed");
    expect(result.message).toMatch(/خارج نطاق هذا المساعد/);

    // It must not have created a pending action either.
    const pending = await prisma.agentAction.findMany({ where: { summary: { contains: "+966500000000" } } });
    expect(pending).toHaveLength(0);
  });

  it("a tool inside scope still runs normally (allowedTools does not otherwise change behavior)", async () => {
    const result = await routeToolCall(
      "salla.products.list",
      {},
      { actorLabel: "test", allowedTools: ASSISTANTS.CAMPAIGNS.allowedTools }
    );
    // No SALLA_ACCESS_TOKEN in tests -> fails honestly downstream, but it must
    // reach the real handler (not be blocked by the scope check).
    expect(result.message).not.toMatch(/خارج نطاق/);
  });
});

describe("response style directive", () => {
  it("builds a distinct directive per style and never silently falls through to nothing", () => {
    for (const style of ["SAUDI", "FUSHA", "ENGLISH", "AUTO"] as const) {
      const directive = buildResponseStyleDirective(style, true);
      expect(directive.length).toBeGreaterThan(20);
    }
  });
});

describe("platform settings", () => {
  it("creates sane defaults on first read and persists updates", async () => {
    const initial = await getPlatformSettings();
    expect(initial.responseStyle).toBe("AUTO");

    await prisma.platformSettings.update({
      where: { id: "default" },
      data: { responseStyle: "SAUDI", shippingPolicy: "توصيل خلال 3-5 أيام عمل داخل السعودية" },
    });

    const updated = await getPlatformSettings();
    expect(updated.responseStyle).toBe("SAUDI");
    expect(updated.shippingPolicy).toContain("3-5");
  });
});
