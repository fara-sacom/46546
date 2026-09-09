import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { syncToolRegistry } from "../src/agent/toolRegistry.js";
import { routeToolCall } from "../src/agent/router.js";

describe("permission engine (READ / DRAFT / ACTION)", () => {
  beforeAll(async () => {
    await syncToolRegistry();
  });

  it("READ tools execute immediately and log an audit entry even when the integration fails", async () => {
    // No SALLA_ACCESS_TOKEN is set in the test environment (see tests/setup.ts),
    // so this proves two things at once: READ never blocks on approval, and a
    // misconfigured integration fails loudly instead of returning fake data.
    const result = await routeToolCall("salla.orders.statuses", {}, { actorLabel: "test" });

    expect(result.status).toBe("failed");
    expect(result.tier).toBe("READ");
    expect(result.message).toMatch(/غير مُفعّل/);

    const audit = await prisma.auditLog.findFirst({
      where: { requestText: { contains: "salla.orders.statuses" } },
      orderBy: { createdAt: "desc" },
    });
    expect(audit?.result).toBe("failed");
    expect(audit?.tier).toBe("READ");
  });

  it("DRAFT tools execute and persist a local draft, without ever touching an external system", async () => {
    const result = await routeToolCall(
      "whatsapp.draftReply",
      { language: "ar", text: "حياكِ الله، المقاس المتوفر حاليًا هو M وL." },
      { actorLabel: "test" }
    );

    expect(result.status).toBe("executed");
    expect(result.tier).toBe("DRAFT");
    const data = result.data as { draftId: string; status: string };
    expect(data.status).toBe("draft");

    const stored = await prisma.customerReplyDraft.findUnique({ where: { id: data.draftId } });
    expect(stored?.status).toBe("draft");

    // A DRAFT tool call must never create a pending approval item.
    const pendingForThisDraft = await prisma.agentAction.findMany({ where: { summary: { contains: data.draftId } } });
    expect(pendingForThisDraft).toHaveLength(0);
  });

  it("ACTION tools are NEVER invoked directly - they only ever create a pending approval", async () => {
    const result = await routeToolCall(
      "whatsapp.sendMessage",
      { to: "+966500000000", text: "رسالة تجريبية" },
      { actorLabel: "test" }
    );

    // Because the handler is never called for ACTION tier, this succeeds even
    // though WHATSAPP_ACCESS_TOKEN is unset - proving the gate runs BEFORE
    // any external call is attempted.
    expect(result.status).toBe("pending_approval");
    expect(result.tier).toBe("ACTION");
    expect(result.actionId).toBeTruthy();
    expect(result.message).toMatch(/بانتظار موافقتك/);

    const action = await prisma.agentAction.findUniqueOrThrow({ where: { id: result.actionId! } });
    expect(action.status).toBe("PENDING");

    const audit = await prisma.auditLog.findFirst({ where: { actionId: action.id } });
    expect(audit?.result).toBe("pending");
  });

  it("rejects calls to unknown tool names", async () => {
    await expect(routeToolCall("does.not.exist", {}, { actorLabel: "test" })).rejects.toThrow(/أداة غير معروفة/);
  });
});
