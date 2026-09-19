import type { ToolDefinition } from "../../agent/types.js";
import { sendWhatsAppText, sendWhatsAppTemplate } from "./client.js";
import { isWithinCustomerServiceWindow } from "./window.js";
import { prisma } from "../../db.js";

export const whatsappTools: ToolDefinition[] = [
  {
    name: "whatsapp.draftReply",
    integration: "whatsapp",
    tier: "DRAFT",
    description:
      "تجهيز مسودة رد على عميلة عبر واتساب (بالأسلوب السعودي الراقي بالعربية، أو الإنجليزية للعملاء الدوليين) دون إرسالها",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        language: { type: "string", enum: ["ar", "en"] },
        text: { type: "string" },
      },
      required: ["language", "text"],
    },
    handler: async (input, ctx) => {
      const draft = await prisma.customerReplyDraft.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          channel: "WHATSAPP",
          language: input.language,
          draftText: input.text,
        },
      });
      return { draftId: draft.id, status: draft.status, text: draft.draftText };
    },
  },
  {
    name: "whatsapp.sendMessage",
    integration: "whatsapp",
    tier: "ACTION",
    description:
      "إرسال رسالة نصية حرة (غير قالب) فعليًا للعميل عبر واتساب - تعمل فقط ضمن نافذة الـ24 ساعة من آخر رسالة واردة من العميلة (قيد فعلي من ميتا، وليس تعليمة داخلية). خارج هذه النافذة تفشل الأداة وترشدك لاستخدام whatsapp.sendTemplateMessage بدلًا منها.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "رقم العميل بصيغة دولية" },
        text: { type: "string" },
        draftId: { type: "string", description: "معرّف مسودة سابقة، اختياري" },
      },
      required: ["to", "text"],
    },
    handler: async (input, ctx) => {
      if (ctx.conversationId) {
        const withinWindow = await isWithinCustomerServiceWindow(ctx.conversationId);
        if (!withinWindow) {
          throw new Error(
            "خارج نافذة الـ24 ساعة منذ آخر رسالة واردة من العميلة - ميتا لا تسمح بإرسال رسالة حرة الآن. استخدمي whatsapp.sendTemplateMessage بقالب معتمد فعليًا من واتساب بزنس مانجر بدل هذه الأداة."
          );
        }
      }
      const result = await sendWhatsAppText(input.to, input.text);
      if (input.draftId) {
        await prisma.customerReplyDraft.update({ where: { id: input.draftId }, data: { status: "sent" } }).catch(() => undefined);
      }
      return result;
    },
    summarize: (input) => `إرسال رسالة واتساب إلى ${input.to}: "${String(input.text).slice(0, 80)}"`,
  },
  {
    name: "whatsapp.sendTemplateMessage",
    integration: "whatsapp",
    tier: "ACTION",
    description:
      "إرسال رسالة قالب (Template Message) معتمدة فعليًا من واتساب بزنس مانجر - الطريقة الوحيدة المسموحة من ميتا للتواصل خارج نافذة الـ24 ساعة منذ آخر رسالة واردة من العميلة. templateName يجب أن يكون اسم قالب حقيقي مُعتمد للمتجر فعليًا - لا تخترعي اسم قالب أبدًا؛ إن لم تكوني متأكدة من اسم قالب حقيقي متاح، لا تستدعي هذه الأداة وأخبري الفريق أن الأمر يحتاج قالبًا معتمدًا أولًا.",
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string", description: "رقم العميل بصيغة دولية" },
        templateName: { type: "string", description: "اسم القالب الحقيقي المعتمد فعليًا في واتساب بزنس مانجر لهذا المتجر" },
        languageCode: { type: "string", description: "مثل ar أو en_US، حسب لغة القالب المعتمدة" },
        components: { type: "array", description: "متغيرات القالب حسب تعريفه في واتساب بزنس مانجر، اختياري" },
        draftId: { type: "string", description: "معرّف مسودة سابقة، اختياري" },
      },
      required: ["to", "templateName", "languageCode"],
    },
    handler: async (input) => {
      const result = await sendWhatsAppTemplate(input.to, input.templateName, input.languageCode, input.components);
      if (input.draftId) {
        await prisma.customerReplyDraft.update({ where: { id: input.draftId }, data: { status: "sent" } }).catch(() => undefined);
      }
      return result;
    },
    summarize: (input) => `إرسال رسالة قالب "${input.templateName}" إلى ${input.to}`,
  },
];
