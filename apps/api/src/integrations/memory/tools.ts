import type { ToolDefinition } from "../../agent/types.js";
import { prisma } from "../../db.js";

const KNOWN_INTENTS = ["product_price", "check_inventory", "order_status", "create_order", "search_products"] as const;

export const memoryTools: ToolDefinition[] = [
  {
    name: "memory.updateCustomerContext",
    integration: "memory",
    tier: "DRAFT",
    description:
      "تسجيل نية العميلة الحالية و/أو آخر منتج أو طلب تناقشينه معها، لتُستخدم كسياق في محادثات لاحقة لنفس رقم واتساب - لا يلمس أي نظام خارجي، تخزين محلي فقط. استدعيها بعد تحديد نية العميلة بوضوح أو بعد التطرق لمنتج/طلب محدد.",
    inputSchema: {
      type: "object",
      properties: {
        currentIntent: { type: "string", enum: [...KNOWN_INTENTS] },
        lastProduct: {
          type: "object",
          description: "بيانات المنتج الذي تناقشه العميلة حاليًا، مثل {productId, name, sku}",
        },
        lastOrder: {
          type: "object",
          description: "بيانات الطلب الذي تناقشه العميلة حاليًا، مثل {orderId, referenceId, status}",
        },
        cartContext: {
          type: "object",
          description: "العناصر التي تفكر العميلة بطلبها حاليًا (قبل تجهيز مسودة طلب فعلية عبر salla.orders.prepareDraft)",
        },
      },
    },
    handler: async (input, ctx) => {
      if (!ctx.conversationId) {
        return { updated: false, reason: "لا توجد محادثة مرتبطة بهذا الاستدعاء" };
      }
      const conversation = await prisma.conversation.findUnique({ where: { id: ctx.conversationId } });
      if (!conversation?.customerRef) {
        return { updated: false, reason: "لا يوجد معرّف عميلة (customerRef) لهذه المحادثة" };
      }

      // input is untyped tool-call JSON (agent-supplied), so these stay `any` on
      // purpose - Prisma's generated types accept that directly without the
      // strict-mode friction a `Record<string, unknown>` intermediate would hit.
      const currentIntent = input.currentIntent ?? undefined;
      const lastProduct = input.lastProduct ? JSON.stringify(input.lastProduct) : undefined;
      const lastOrder = input.lastOrder ? JSON.stringify(input.lastOrder) : undefined;
      const cartContext = input.cartContext ? JSON.stringify(input.cartContext) : undefined;

      await prisma.customerContext.upsert({
        where: { whatsappNumber: conversation.customerRef },
        create: {
          customerId: conversation.customerRef,
          whatsappNumber: conversation.customerRef,
          conversationId: ctx.conversationId,
          language: conversation.language,
          currentIntent,
          lastProduct,
          lastOrder,
          cartContext,
        },
        update: { conversationId: ctx.conversationId, currentIntent, lastProduct, lastOrder, cartContext },
      });

      return { updated: true };
    },
  },
];
