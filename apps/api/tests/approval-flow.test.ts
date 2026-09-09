import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { syncToolRegistry } from "../src/agent/toolRegistry.js";
import { routeToolCall } from "../src/agent/router.js";
import { approveAction, rejectAction, ActionNotPendingError } from "../src/approvals/service.js";

async function makeStaff(email: string, role: "ADMIN" | "OPERATOR" = "ADMIN") {
  return prisma.staffUser.create({ data: { name: "Test Staff", email, role, apiKeyHash: `hash-${email}` } });
}

describe("approval workflow", () => {
  beforeAll(async () => {
    await syncToolRegistry();
  });

  it("approving a pending ACTION actually calls the tool and records the real outcome (including failure)", async () => {
    const staff = await makeStaff("approver1@fara.test");
    const pending = await routeToolCall("whatsapp.sendMessage", { to: "+966500000001", text: "hi" }, { actorLabel: "test" });

    const decided = await approveAction(pending.actionId!, staff.id);

    // WHATSAPP_ACCESS_TOKEN is unset in tests, so the real handler runs and
    // fails honestly - it must NOT be silently marked as executed.
    expect(decided.status).toBe("FAILED");
    expect(decided.error).toMatch(/واتساب غير مُفعّل/);
    expect(decided.decidedById).toBe(staff.id);
    expect(decided.decidedAt).not.toBeNull();

    const audit = await prisma.auditLog.findFirst({ where: { actionId: decided.id }, orderBy: { createdAt: "desc" } });
    expect(audit?.result).toBe("failed");
  });

  it("rejecting a pending ACTION marks it REJECTED and never runs the tool", async () => {
    const staff = await makeStaff("approver2@fara.test");
    const pending = await routeToolCall("whatsapp.sendMessage", { to: "+966500000002", text: "hi" }, { actorLabel: "test" });

    const decided = await rejectAction(pending.actionId!, staff.id, "لا داعي لإرسالها الآن");

    expect(decided.status).toBe("REJECTED");
    expect(decided.decisionNote).toBe("لا داعي لإرسالها الآن");

    const audit = await prisma.auditLog.findFirst({ where: { actionId: decided.id } });
    expect(audit?.result).toBe("rejected");
  });

  it("refuses to decide on an action twice", async () => {
    const staff = await makeStaff("approver3@fara.test");
    const pending = await routeToolCall("whatsapp.sendMessage", { to: "+966500000003", text: "hi" }, { actorLabel: "test" });
    await rejectAction(pending.actionId!, staff.id);

    await expect(rejectAction(pending.actionId!, staff.id)).rejects.toBeInstanceOf(ActionNotPendingError);
    await expect(approveAction(pending.actionId!, staff.id)).rejects.toBeInstanceOf(ActionNotPendingError);
  });

  it("every full request -> tool -> decision cycle leaves a traceable audit trail", async () => {
    const staff = await makeStaff("approver4@fara.test");
    const pending = await routeToolCall("salla.products.update", { id: 123, changes: { price: 90 } }, { actorLabel: "test", staffUserId: staff.id });
    await approveAction(pending.actionId!, staff.id, "وافقت على تعديل السعر");

    const entries = await prisma.auditLog.findMany({ where: { actionId: pending.actionId! }, orderBy: { createdAt: "asc" } });
    // one entry when the ACTION was requested (pending), one when it was decided.
    expect(entries.length).toBeGreaterThanOrEqual(2);
    expect(entries[0].result).toBe("pending");
    expect(entries.at(-1)?.result).toBe("failed"); // no SALLA_ACCESS_TOKEN in tests -> honest failure, not a fake success
  });
});
