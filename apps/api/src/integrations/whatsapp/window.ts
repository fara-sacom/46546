import { prisma } from "../../db.js";

/**
 * Meta's WhatsApp Cloud API only allows a free-form (non-template) business-initiated
 * message within 24 hours of the customer's last inbound message - this is a real
 * constraint enforced by Meta itself (the "customer service window"), not an internal
 * policy. Outside that window, Meta rejects free-form sends and only a pre-approved
 * Message Template may be sent. Message.role "USER" is always the customer's own text
 * (set in routes/webhooks.ts on every inbound message), so its latest timestamp is the
 * real anchor for the window - never guessed or assumed open.
 */
export async function isWithinCustomerServiceWindow(conversationId: string): Promise<boolean> {
  const lastCustomerMessage = await prisma.message.findFirst({
    where: { conversationId, role: "USER" },
    orderBy: { createdAt: "desc" },
  });
  if (!lastCustomerMessage) return false;
  const hoursSinceLastCustomerMessage = (Date.now() - lastCustomerMessage.createdAt.getTime()) / (1000 * 60 * 60);
  return hoursSinceLastCustomerMessage < 24;
}
