// Arabic display labels for every raw enum/status value the API returns.
// Technical identifiers that must stay exact for debugging (tool names like
// "salla.products.list", raw JSON payloads) are intentionally left as-is.

export const TIER_LABEL: Record<string, string> = {
  READ: "قراءة",
  DRAFT: "مسودة",
  ACTION: "إجراء",
};

export const ACTION_STATUS_LABEL: Record<string, string> = {
  PENDING: "بانتظار الموافقة",
  APPROVED: "تمت الموافقة (يُنفَّذ الآن)",
  EXECUTED: "تم التنفيذ",
  FAILED: "فشل",
  REJECTED: "مرفوض",
};

export const AUDIT_RESULT_LABEL: Record<string, string> = {
  success: "نجاح",
  failed: "فشل",
  pending: "قيد الانتظار",
  rejected: "مرفوض",
};

export const TOOL_CALL_STATUS_LABEL: Record<string, string> = {
  executed: "تم التنفيذ",
  pending_approval: "بانتظار الموافقة",
  failed: "فشل",
};

export const CHANNEL_LABEL: Record<string, string> = {
  DASHBOARD: "لوحة التحكم",
  WHATSAPP: "واتساب",
  INSTAGRAM: "إنستغرام",
  TIKTOK: "تيك توك",
  SNAPCHAT: "سناب شات",
  YOUTUBE: "يوتيوب",
};

export const INTEGRATION_LABEL: Record<string, string> = {
  salla: "سلة",
  whatsapp: "واتساب",
  youtube: "يوتيوب",
  meta: "ميتا (إنستغرام / فيسبوك)",
  tiktok: "تيك توك",
  snapchat: "سناب شات",
  system: "عام",
  "claude-vision": "تحليل الصور (Claude)",
  tavily: "البحث (Tavily)",
  mymemory: "الترجمة (MyMemory)",
  huggingface: "توليد الصور (Hugging Face)",
  removebg: "إزالة الخلفية (remove.bg)",
  instagram: "رسائل إنستغرام",
  tiktokComments: "تعليقات تيك توك",
};

export const LANGUAGE_LABEL: Record<string, string> = {
  ar: "عربي",
  en: "إنجليزي",
};

export const RESPONSE_STYLE_LABEL: Record<string, string> = {
  SAUDI: "سعودي",
  FUSHA: "فصحى",
  ENGLISH: "إنجليزي",
  AUTO: "تلقائي حسب لغة العميل",
};

export function tr(map: Record<string, string>, key: string): string {
  return map[key] ?? key;
}
