import type { ToolDefinition } from "../../agent/types.js";
import { products, inventory, orders, customers, categories, reviews, abandonedCarts, storePages, analytics, type SallaProductVariant } from "./api.js";
import { prisma } from "../../db.js";

/** Real option values for a variant - Salla reports these under `options`; `option_values` is only a defensive fallback. */
function variantOptionValues(v: SallaProductVariant): Array<{ value?: string }> {
  return (v.options ?? v.option_values ?? []) as Array<{ value?: string }>;
}

/** Exact (case-insensitive) match against a variant's real option values only - never a SKU substring match, which can silently match the wrong size/color. */
function variantMatchesValue(v: SallaProductVariant, needle: string): boolean {
  return variantOptionValues(v).some((ov) => String(ov.value ?? "").trim().toLowerCase() === needle);
}

/** Absent/null quantity means Salla didn't report a count (e.g. an unlimited-stock SKU) - that's "unknown", never "out of stock". */
function resolveVariantStock(v: SallaProductVariant, requestedQuantity = 1): { quantity: number | null; inStock: boolean | null } {
  const quantity = typeof v.quantity === "number" ? v.quantity : null;
  if (quantity === null) return { quantity: null, inStock: null };
  return { quantity, inStock: quantity >= requestedQuantity };
}

export const sallaTools: ToolDefinition[] = [
  // ---------------- READ ----------------
  {
    name: "salla.products.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة قائمة المنتجات من متجر سلة (مع الترقيم)",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        per_page: { type: "number" },
        status: { type: "string", description: "sale | hidden | out" },
      },
    },
    handler: (input) => products.list(input),
  },
  {
    name: "salla.products.get",
    integration: "salla",
    tier: "READ",
    description: "قراءة تفاصيل منتج واحد (السعر، المقاسات/الألوان عبر options، المخزون، SKU، الرابط)",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    handler: (input) => products.get(input.id),
  },
  {
    name: "salla.products.search",
    integration: "salla",
    tier: "READ",
    description: "البحث عن منتجات بكلمة مفتاحية (اسم، وصف)",
    inputSchema: {
      type: "object",
      properties: { keyword: { type: "string" }, page: { type: "number" }, per_page: { type: "number" } },
      required: ["keyword"],
    },
    handler: (input) => products.search(input.keyword, input),
  },
  {
    name: "salla.products.getBySku",
    integration: "salla",
    tier: "READ",
    description: "البحث عن منتج بواسطة SKU",
    inputSchema: { type: "object", properties: { sku: { type: "string" } }, required: ["sku"] },
    handler: (input) => products.getBySku(input.sku),
  },
  {
    name: "salla.products.getVariants",
    integration: "salla",
    tier: "READ",
    description: "قراءة متغيرات منتج (كل تركيبة مقاس/لون) مع السعر والمخزون الحقيقي لكل متغيّر على حدة - استخدميها قبل تأكيد توفر مقاس/لون معيّن للعميلة",
    inputSchema: { type: "object", properties: { id: { type: "number", description: "معرّف المنتج" } }, required: ["id"] },
    handler: (input) => products.getVariants(input.id),
  },
  {
    name: "salla.inventory.checkVariant",
    integration: "salla",
    tier: "READ",
    description: "التحقق من توفر مخزون متغيّر محدد لمنتج (مثال: مقاس M أو لون أحمر) بمطابقة قيمة الخيار ضمن متغيرات المنتج الحقيقية من سلة - لا تفترضي التوفر أبدًا، استعلمي بهذه الأداة",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number", description: "معرّف المنتج" },
        variant: { type: "string", description: "قيمة الخيار المطلوب التحقق من توفره، مثل M أو أحمر" },
      },
      required: ["id", "variant"],
    },
    handler: async (input) => {
      const res = await products.getVariants(input.id);
      const needle = String(input.variant).trim().toLowerCase();
      const matches = (res.data ?? []).filter((v) => variantMatchesValue(v, needle));
      if (matches.length === 0) {
        return { found: false, message: `لا يوجد متغيّر مطابق لـ "${input.variant}" ضمن متغيرات هذا المنتج.` };
      }
      return {
        found: true,
        variants: matches.map((v) => {
          const stock = resolveVariantStock(v);
          return {
            id: v.id,
            sku: v.sku,
            quantity: stock.quantity,
            inStock: stock.inStock,
            note: stock.inStock === null ? "سلة لم تُرجع كمية محددة لهذا المتغيّر (قد يكون مخزونًا غير محدود) - لا تؤكدي التوفر أو عدمه للعميلة، تحققي يدويًا إن لزم." : undefined,
            price: v.sale_price ?? v.price,
            optionValues: variantOptionValues(v),
          };
        }),
      };
    },
  },
  {
    name: "salla.inventory.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة كميات المخزون لكل منتج",
    inputSchema: { type: "object", properties: { page: { type: "number" }, per_page: { type: "number" } } },
    handler: (input) => inventory.list(input),
  },
  {
    name: "salla.orders.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة قائمة الطلبات مع إمكانية الفلترة بالحالة أو التاريخ",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        per_page: { type: "number" },
        status: { type: "string" },
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
      },
    },
    handler: (input) => orders.list(input),
  },
  {
    name: "salla.orders.get",
    integration: "salla",
    tier: "READ",
    description: "قراءة تفاصيل طلب واحد وحالته الحالية",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    handler: (input) => orders.get(input.id),
  },
  {
    name: "salla.orders.statuses",
    integration: "salla",
    tier: "READ",
    description: "قراءة قائمة حالات الطلبات المتاحة في المتجر",
    inputSchema: { type: "object", properties: {} },
    handler: () => orders.statuses(),
  },
  {
    name: "salla.orders.history",
    integration: "salla",
    tier: "READ",
    description: "قراءة سجل تتبع حالة طلب معيّن",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    handler: (input) => orders.history(input.id),
  },
  {
    name: "salla.customers.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة قائمة العملاء",
    inputSchema: { type: "object", properties: { page: { type: "number" }, per_page: { type: "number" }, keyword: { type: "string" } } },
    handler: (input) => customers.list(input),
  },
  {
    name: "salla.customers.get",
    integration: "salla",
    tier: "READ",
    description: "قراءة تفاصيل عميل واحد",
    inputSchema: { type: "object", properties: { id: { type: "number" } }, required: ["id"] },
    handler: (input) => customers.get(input.id),
  },
  {
    name: "salla.categories.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة تصنيفات المتجر",
    inputSchema: { type: "object", properties: { page: { type: "number" } } },
    handler: (input) => categories.list(input),
  },
  {
    name: "salla.reviews.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة تقييمات العملاء (عامة أو لمنتج محدد)",
    inputSchema: { type: "object", properties: { page: { type: "number" }, product_id: { type: "number" } } },
    handler: (input) => reviews.list(input),
  },
  {
    name: "salla.abandonedCarts.list",
    integration: "salla",
    tier: "READ",
    description: "قراءة السلال المتروكة لفهم فرص استرجاع المبيعات",
    inputSchema: { type: "object", properties: { page: { type: "number" } } },
    handler: (input) => abandonedCarts.list(input),
  },
  {
    name: "salla.storePages.listMenus",
    integration: "salla",
    tier: "READ",
    description: "قراءة قوائم التنقل بالمتجر (للتحقق من روابط المنتجات الصحيحة)",
    inputSchema: { type: "object", properties: {} },
    handler: () => storePages.listMenus(),
  },
  {
    name: "salla.analytics.salesSummary",
    integration: "salla",
    tier: "READ",
    description: "تحليل المبيعات: إجمالي المبيعات، متوسط قيمة الطلب، وأفضل المنتجات مبيعًا خلال فترة معيّنة",
    inputSchema: {
      type: "object",
      properties: {
        from: { type: "string", description: "YYYY-MM-DD" },
        to: { type: "string", description: "YYYY-MM-DD" },
        sampleSize: { type: "number", description: "أقصى عدد طلبات يُحلَّل، افتراضيًا 200" },
      },
    },
    handler: (input) => analytics.salesSummary(input),
  },
  {
    name: "salla.analytics.lowStockProducts",
    integration: "salla",
    tier: "READ",
    description: "معرفة المنتجات ذات المخزون المنخفض",
    inputSchema: {
      type: "object",
      properties: { threshold: { type: "number", description: "الحد الأدنى للكمية، افتراضيًا 5" } },
    },
    handler: (input) => analytics.lowStockProducts(input?.threshold),
  },

  // ---------------- DRAFT (no external effect) ----------------
  {
    name: "salla.products.proposeUpdate",
    integration: "salla",
    tier: "DRAFT",
    description:
      "تجهيز مقترح تعديل لمنتج (سعر/مخزون/اسم/حالة) دون تنفيذه فعليًا - يعيد المقارنة بين القيم الحالية والمقترحة",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
        changes: { type: "object", description: "الحقول المقترح تغييرها، مثل {price: 90}" },
      },
      required: ["id", "changes"],
    },
    handler: async (input) => {
      const current = await products.get(input.id);
      const before: Record<string, unknown> = {};
      for (const key of Object.keys(input.changes)) before[key] = (current.data as any)[key];
      return {
        productId: input.id,
        productName: current.data.name,
        before,
        proposed: input.changes,
        note: "هذا مقترح فقط ولم يُطبَّق على المتجر - يحتاج موافقة صريحة قبل التنفيذ عبر salla.products.update",
      };
    },
  },
  {
    name: "salla.orders.prepareDraft",
    integration: "salla",
    tier: "DRAFT",
    description:
      "تجهيز مسودة طلب/سلة لعميلة تريد الشراء عبر واتساب (السعر والتوفر من بيانات سلة الحقيقية) - لا يُنشئ أي طلب فعلي في سلة أبدًا، ولا يُنشئ رابط دفع مباشر. يعيد لكل منتج رابط صفحته الحقيقي في المتجر (productUrl) لترسليه للعميلة كي تختار مقاسها وتُتم الدفع بنفسها عبر checkout سلة الفعلي؛ إنشاء الطلب الفعلي في النظام يبقى عمل يدوي لفريق المبيعات",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        customerRef: { type: "string", description: "رقم واتساب العميلة أو معرّفها، إن توفر" },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              productId: { type: "number" },
              variant: { type: "string", description: "قيمة الخيار المطلوب مثل M أو أحمر، اختياري" },
              quantity: { type: "number" },
            },
            required: ["productId", "quantity"],
          },
        },
        note: { type: "string" },
      },
      required: ["items"],
    },
    handler: async (input, ctx) => {
      let estimatedTotal = 0;
      let currency = "SAR";
      const resolvedItems = [];
      for (const item of input.items as Array<{ productId: number; variant?: string; quantity: number }>) {
        const productRes = await products.get(item.productId);
        const product = productRes.data;
        let unitPrice = product.sale_price ?? product.price;
        let quantityAvailable: number | null = product.quantity ?? null;
        let variantMatched = false;
        let variantInfo: unknown = null;

        if (item.variant) {
          const variantsRes = await products.getVariants(item.productId);
          const needle = String(item.variant).trim().toLowerCase();
          const match = (variantsRes.data ?? []).find((v) => variantMatchesValue(v, needle));
          if (match) {
            variantMatched = true;
            unitPrice = match.sale_price ?? match.price ?? unitPrice;
            quantityAvailable = match.quantity ?? null;
            variantInfo = { sku: match.sku, optionValues: variantOptionValues(match) };
          }
        }

        const inStock = quantityAvailable == null ? null : quantityAvailable >= item.quantity;
        if (unitPrice?.amount) {
          estimatedTotal += unitPrice.amount * item.quantity;
          currency = unitPrice.currency ?? currency;
        }

        resolvedItems.push({
          productId: item.productId,
          productName: product.name,
          requestedVariant: item.variant ?? null,
          variantMatched: item.variant ? variantMatched : null,
          variantInfo,
          quantity: item.quantity,
          unitPrice,
          quantityAvailable,
          inStock,
          // Real Salla storefront link (never a fabricated cart/payment-link API call) -
          // the customer picks her size and pays through Salla's actual checkout herself.
          productUrl: product.urls?.customer ?? null,
        });
      }

      const draft = await prisma.orderDraft.create({
        data: {
          conversationId: input.conversationId ?? ctx.conversationId,
          customerRef: input.customerRef,
          itemsJson: JSON.stringify(resolvedItems),
          estimatedTotal,
          currency,
          note: input.note,
        },
      });

      return {
        draftId: draft.id,
        status: draft.status,
        items: resolvedItems,
        estimatedTotal,
        currency,
        note: "هذا طلب مقترح فقط بناءً على بيانات سلة الحقيقية - لم يُنشأ أي طلب فعلي في سلة ولا رابط دفع مباشر. أرسلي للعميلة productUrl الحقيقي لكل منتج لتُتم اختيار المقاس والدفع بنفسها، أو انتظري متابعة فريق المبيعات لإتمام الطلب.",
      };
    },
  },

  // ---------------- ACTION (requires explicit human approval) ----------------
  {
    name: "salla.products.update",
    integration: "salla",
    tier: "ACTION",
    description: "تطبيق تعديل فعلي على بيانات منتج (سعر/مخزون/اسم/حالة) في متجر سلة",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, changes: { type: "object" } },
      required: ["id", "changes"],
    },
    handler: (input) => products.update(input.id, input.changes),
    summarize: (input) => `تعديل المنتج #${input.id}: ${JSON.stringify(input.changes)}`,
  },
  {
    name: "salla.products.create",
    integration: "salla",
    tier: "ACTION",
    description: "إنشاء منتج جديد فعليًا في متجر سلة",
    inputSchema: { type: "object", properties: { payload: { type: "object" } }, required: ["payload"] },
    handler: (input) => products.create(input.payload),
    summarize: (input) => `إنشاء منتج جديد: ${input.payload?.name ?? "بدون اسم"}`,
  },
  {
    name: "salla.products.addImage",
    integration: "salla",
    tier: "ACTION",
    description: "إضافة صورة لمنتج في المتجر",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, image: { type: "string" }, alt: { type: "string" } },
      required: ["id", "image"],
    },
    handler: (input) => products.addImage(input.id, input),
    summarize: (input) => `إضافة صورة للمنتج #${input.id}`,
  },
  {
    name: "salla.inventory.update",
    integration: "salla",
    tier: "ACTION",
    description: "تحديث كمية المخزون فعليًا لمنتج",
    inputSchema: {
      type: "object",
      properties: { productId: { type: "number" }, quantity: { type: "number" } },
      required: ["productId", "quantity"],
    },
    handler: (input) => inventory.update(input.productId, input.quantity),
    summarize: (input) => `تحديث مخزون المنتج #${input.productId} إلى ${input.quantity}`,
  },
  {
    name: "salla.orders.updateStatus",
    integration: "salla",
    tier: "ACTION",
    description: "تحديث حالة طلب فعليًا (مثال: تحويله إلى قيد الشحن)",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" }, statusSlug: { type: "string" }, note: { type: "string" } },
      required: ["id", "statusSlug"],
    },
    handler: (input) => orders.updateStatus(input.id, input.statusSlug, input.note),
    summarize: (input) => `تحديث حالة الطلب #${input.id} إلى "${input.statusSlug}"`,
  },
  {
    name: "salla.orders.addHistoryNote",
    integration: "salla",
    tier: "ACTION",
    description: "إضافة ملاحظة إلى سجل تتبع الطلب",
    inputSchema: { type: "object", properties: { id: { type: "number" }, note: { type: "string" } }, required: ["id", "note"] },
    handler: (input) => orders.addHistoryNote(input.id, input.note),
    summarize: (input) => `إضافة ملاحظة لسجل الطلب #${input.id}`,
  },
];
