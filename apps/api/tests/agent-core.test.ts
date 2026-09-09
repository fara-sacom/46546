import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/db.js";
import { runAgentTurn, AgentNotConfiguredError } from "../src/agent/core.js";

describe("agent core fails closed without ANTHROPIC_API_KEY", () => {
  it("throws AgentNotConfiguredError and does not write a half-formed message", async () => {
    const conversation = await prisma.conversation.create({ data: { channel: "DASHBOARD", language: "ar" } });

    await expect(runAgentTurn(conversation.id, "مرحبا", { actorLabel: "test" })).rejects.toBeInstanceOf(AgentNotConfiguredError);

    const messages = await prisma.message.findMany({ where: { conversationId: conversation.id } });
    expect(messages).toHaveLength(0);
  });
});
