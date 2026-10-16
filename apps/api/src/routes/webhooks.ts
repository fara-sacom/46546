import { Router } from "express";
import { prisma } from "../db.js";
import { env } from "../env.js";
import { runAgentTurn, AgentNotConfiguredError } from "../agent/core.js";

export const webhooksRouter = Router();

// Meta webhook verification handshake (GET) - https://developers.facebook.com/docs/graph-api/webhooks/getting-started
webhooksRouter.get("/webhooks/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === env.whatsapp.verifyToken && env.whatsapp.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Inbound WhatsApp messages. The agent reads the message and may prepare a
// DRAFT reply or analysis, but never sends anything back automatically -
// whatsapp.sendMessage is an ACTION tool and always waits for staff approval.
webhooksRouter.post("/webhooks/whatsapp", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return res.sendStatus(200); // status callbacks etc. - nothing to do

    const from: string = message.from;
    const text: string = message.text?.body ?? "";

    let conversation = await prisma.conversation.findFirst({ where: { channel: "WHATSAPP", customerRef: from, status: "open" } });
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { channel: "WHATSAPP", customerRef: from, language: "ar" } });
    }

    // Structural cross-conversation memory fields are kept in sync here, on every
    // inbound message - never left to the agent remembering to call a tool. The
    // interpretive fields (currentIntent/lastProduct/lastOrder/cartContext) are
    // only ever set explicitly by the agent via memory.updateCustomerContext.
    await prisma.customerContext.upsert({
      where: { whatsappNumber: from },
      create: { customerId: from, whatsappNumber: from, conversationId: conversation.id, lastMessage: text, language: conversation.language },
      update: { conversationId: conversation.id, lastMessage: text, language: conversation.language },
    });

    await runAgentTurn(conversation.id, text, { actorLabel: `Customer via WhatsApp (${from})` });
    res.sendStatus(200);
  } catch (err) {
    if (err instanceof AgentNotConfiguredError) {
      // Still ack the webhook so Meta doesn't retry-storm us; the message is preserved for when the agent is configured.
      res.sendStatus(200);
      return;
    }
    console.error("WhatsApp webhook error", err);
    res.sendStatus(200);
  }
});
