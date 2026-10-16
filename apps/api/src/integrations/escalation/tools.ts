import type { ToolDefinition } from "../../agent/types.js";
import { prisma } from "../../db.js";

export const escalationTools: ToolDefinition[] = [
  {
    name: "escalation.flagConversation",
    integration: "escalation",
    tier: "DRAFT",
    description:
      "تصعيد المحادثة لمتابعة موظف بشري - استدعيها في كل الحالات المذكورة في قسم 11 من سياسات المتجر (غضب شديد، مشكلة مالية، حالة تابي/تمارا تحتاج تدخلاً، عيب منتج يحتاج قرارًا، عدم تأكدك من الإجابة، أو طلب العميلة صراحة موظفًا بشريًا)، دائمًا بالإضافة لإخبار العميلة نصيًا أن فريق الدعم سيتابع - ليس بديلاً عن ذلك. تضع علامة escalated=true تظهر لفريق الدعم عبر GET /api/conversations. لا يوجد إشعار فوري للموظفين حاليًا (فجوة معروفة) - هذه علامة يراجعها الفريق، وليست تنبيهًا لحظيًا.",
    inputSchema: {
      type: "object",
      properties: {
        reason: { type: "string", description: "سبب التصعيد بإيجاز، مثل: مشكلة مالية في طلب رقم 123" },
      },
      required: ["reason"],
    },
    handler: async (input, ctx) => {
      if (!ctx.conversationId) {
        return { flagged: false, reason: "لا توجد محادثة مرتبطة بهذا الاستدعاء" };
      }
      await prisma.conversation.update({
        where: { id: ctx.conversationId },
        data: { escalated: true, escalationReason: input.reason, escalatedAt: new Date() },
      });
      return { flagged: true };
    },
  },
];
