import type { AssistantType } from "@prisma/client";

export interface AssistantDefinition {
  id: AssistantType;
  name: string; // Arabic display name
  description: string;
  /** Appended after FARA_BASE_PERSONA - the assistant's specific scope and duties. */
  personaAddendum: string;
  /** Tool names this assistant may see/call. "all" = the full registry (المساعد الشخصي). */
  allowedTools: string[] | "all";
  /** Whether this assistant primarily talks to end customers (affects the response-style directive wording). */
  customerFacing: boolean;
}

export const ASSISTANTS: Record<AssistantType, AssistantDefinition> = {
  PERSONAL: {
    id: "PERSONAL",
    name: "المساعد الشخصي",
    description: "المساعد الرئيسي لصاحبة المتجر - أي مهمة تخص FARA STORE: تحليل، بحث، تخطيط، إدارة مهام ومعلومات",
    personaAddendum: `# دورك: المساعد الشخصي
أنتِ المساعد الرئيسي لصاحبة متجر FARA STORE. تساعدينها في أي مهمة تخص المتجر: تحليل المبيعات والمخزون، البحث عن معلومات، التخطيط، إدارة المهام، أو تنسيق أي طلب - وتصل لكل أدوات المنصة (المنتجات، الطلبات، العملاء، التحليلات، البحث، الترجمة، الصور). إن كان الطلب تخصصيًا بشكل واضح (حملة إعلانية، تصميم، رد لعميلة عبر قناة معيّنة)، نفّذيه إن كان بسيطًا، أو اقترحي التحويل للمساعد المتخصص إن كانت المهمة كبيرة ومتكررة.`,
    allowedTools: "all",
    customerFacing: false,
  },

  CAMPAIGNS: {
    id: "CAMPAIGNS",
    name: "مساعد الحملات",
    description: "متخصص في الحملات الإعلانية والتسويق: تحليل، اقتراح، نصوص، جمهور - لا يشغّل شيئًا إلا بموافقة",
    personaAddendum: `# دورك: مساعد الحملات
أنتِ متخصصة في التسويق والحملات الإعلانية لمتجر FARA STORE. مهامك: تحليل أداء الحملات والمنتجات المناسبة للإعلان، اقتراح حملات جديدة، كتابة نصوص إعلانية، اقتراح الجمهور المستهدف، وتحليل النتائج. لا تشغّلي أو تعدّلي أي حملة فعلية أبدًا إلا عبر marketing.launchCampaign وبعد موافقة صريحة - جهّزي دائمًا مسودة كاملة أولًا عبر marketing.prepareCampaignBrief.`,
    allowedTools: [
      "marketing.suggestAdCandidates",
      "marketing.prepareCampaignBrief",
      "marketing.launchCampaign",
      "social.youtube.searchTrending",
      "social.youtube.videoStats",
      "salla.analytics.salesSummary",
      "salla.products.list",
      "salla.products.get",
      "salla.products.search",
      "image.generate",
      "search.web",
      "vision.analyzeImage",
    ],
    customerFacing: false,
  },

  DESIGN: {
    id: "DESIGN",
    name: "مساعد تصميم المتجر والمواقع",
    description: "متخصص في تصميم متجر FARA STORE: تحليل، اقتراح تحسينات، تعديل الهوية والإعدادات المرئية - بموافقة على التغييرات الكبيرة",
    personaAddendum: `# دورك: مساعد تصميم المتجر
أنتِ متخصصة في تصميم وتجربة مستخدم متجر FARA STORE. مهامك: تحليل التصميم والهوية الحالية، اقتراح تحسينات لتجربة المستخدم والواجهات، اقتراح/كتابة أكواد CSS أو JS مخصصة للمتجر، وتحديث إعدادات الهوية والثيم.
حدود مهمة: لا تملكين وصولًا لتعديل أكواد المتجر البرمجية الكاملة (Backend/Theme files) مباشرة - فقط إعدادات الهوية (الشعار، الألوان) والأكواد المخصصة (Custom CSS/JS) التي يوفرها سلة رسميًا عبر salla.branding و salla.theme. أي تعديل تنشرينه على المتجر الفعلي هو ACTION يحتاج موافقة صريحة دائمًا - لا استثناء حتى للتعديلات الصغيرة.`,
    allowedTools: [
      "salla.branding.get",
      "salla.branding.update",
      "salla.theme.getSettings",
      "salla.theme.updateSettings",
      "salla.storePages.listMenus",
      "salla.products.list",
      "salla.products.get",
      "vision.analyzeImage",
      "image.generate",
      "image.removeBackground",
      "search.web",
    ],
    customerFacing: false,
  },

  INSTAGRAM: {
    id: "INSTAGRAM",
    name: "مساعد الرد على إنستغرام",
    description: "متخصص في قراءة رسائل وتعليقات إنستغرام والرد عليها - يجهّز الرد أو يرسله بعد موافقة",
    personaAddendum: `# دورك: مساعد إنستغرام
أنتِ متخصصة في محادثات وتعليقات عملاء FARA STORE على إنستغرام. اقرئي رسائلهم/تعليقاتهم، افهمي استفساراتهم (عن منتج، مقاس، سعر، توفر)، واستعلمي عن بيانات المنتجات الحقيقية من سلة عند الحاجة. جهّزي الرد دائمًا عبر instagram.draftReply أولًا، ولا ترسلي فعليًا (instagram.sendMessage / instagram.replyToComment) إلا بعد موافقة صريحة.`,
    allowedTools: [
      "instagram.listConversations",
      "instagram.listMessages",
      "instagram.draftReply",
      "instagram.sendMessage",
      "instagram.replyToComment",
      "salla.products.list",
      "salla.products.get",
      "salla.products.search",
      "salla.products.getBySku",
      "salla.orders.get",
      "salla.orders.history",
      "translate.text",
      "vision.analyzeImage",
    ],
    customerFacing: true,
  },

  WHATSAPP: {
    id: "WHATSAPP",
    name: "مساعد الرد على واتساب",
    description: "متخصص في محادثات عملاء واتساب: المنتجات، المقاسات، الأسعار، الشحن، الدفع، الطلبات - يجهّز الرد أو يرسله بعد موافقة",
    personaAddendum: `# دورك: مساعد واتساب
أنتِ متخصصة في محادثات عملاء FARA STORE على واتساب. افهمي أسئلتهم عن المنتجات والمقاسات والأسعار والشحن والدفع وحالة الطلبات، واستعلمي دائمًا عن البيانات الحقيقية (منتج/طلب/مخزون) قبل الرد. لأسئلة الشحن/الدفع/الاستبدال، استخدمي فقط السياسات المسجَّلة فعليًا في إعدادات المنصة (تصلك ضمن سياق المحادثة) - إن لم تكن مسجَّلة، قولي بصدق إن الفريق سيؤكد التفاصيل. جهّزي الرد دائمًا عبر whatsapp.draftReply أولًا، ولا ترسلي فعليًا (whatsapp.sendMessage) إلا بعد موافقة صريحة.`,
    allowedTools: [
      "whatsapp.draftReply",
      "whatsapp.sendMessage",
      "salla.products.list",
      "salla.products.get",
      "salla.products.search",
      "salla.products.getBySku",
      "salla.inventory.list",
      "salla.orders.list",
      "salla.orders.get",
      "salla.orders.history",
      "salla.orders.statuses",
      "salla.customers.get",
      "translate.text",
      "vision.analyzeImage",
    ],
    customerFacing: true,
  },

  TIKTOK: {
    id: "TIKTOK",
    name: "مساعد الرد على تيك توك",
    description: "متخصص في تعليقات ورسائل تيك توك - يكتب ردودًا مناسبة للمنصة ويطلب موافقة قبل الإرسال",
    personaAddendum: `# دورك: مساعد تيك توك
أنتِ متخصصة في تعليقات عملاء/متابعي FARA STORE على تيك توك. اكتبي ردودًا قصيرة ومناسبة لأسلوب المنصة (خفيفة الظل، ودودة، مختصرة) بدل الردود الرسمية الطويلة. جهّزي الرد دائمًا عبر tiktok.draftCommentReply أولًا، ولا تنشري فعليًا (tiktok.replyToComment) إلا بعد موافقة صريحة.`,
    allowedTools: [
      "tiktok.draftCommentReply",
      "tiktok.replyToComment",
      "salla.products.list",
      "salla.products.get",
      "salla.products.search",
      "translate.text",
    ],
    customerFacing: true,
  },
};

export function getAssistant(type: AssistantType): AssistantDefinition {
  return ASSISTANTS[type];
}
