import { env } from "../env.js";
import { isSallaConfigured } from "../integrations/salla/client.js";
import { isWhatsAppConfigured } from "../integrations/whatsapp/client.js";
import { isTavilyConfigured } from "../integrations/search/tavily.js";
import { isHuggingFaceConfigured } from "../integrations/image/huggingface.js";
import { isRemoveBgConfigured } from "../integrations/image/removebg.js";
import { isMetaConfigured, isTikTokConfigured, isSnapchatConfigured } from "../integrations/social/adPlatforms.js";
import { isInstagramConfigured } from "../integrations/instagram/client.js";
import { isTikTokCommentsConfigured } from "../integrations/tiktok/client.js";

export interface AIServiceInfo {
  id: string;
  name: string;
  usedFor: string;
  freeTier: string;
  requiresApiKey: boolean;
  envVar?: string;
  officialUrl: string;
  configured: boolean;
}

/**
 * Every AI/data service FARA AI Agent can call, with the exact free-tier
 * terms researched from each provider's own site. Terms change - re-verify
 * on the provider's pricing page before relying on the numbers here.
 */
export function listAIServices(): AIServiceInfo[] {
  return [
    {
      id: "claude",
      name: "Claude (Anthropic) — عقل الوكيل",
      usedFor: "كتابة المحتوى والردود، تحليل النصوص والبيانات، تحليل الصور (رؤية حاسوبية)، فهم الطلبات واختيار الأدوات المناسبة",
      freeTier: "بدون خطة مجانية دائمة — حساب Anthropic API يُفوتَر حسب الاستخدام. هذا المفتاح يشغّل الوكيل بالكامل، وليس تكاملًا إضافيًا",
      requiresApiKey: true,
      envVar: "ANTHROPIC_API_KEY",
      officialUrl: "https://console.anthropic.com",
      configured: !!env.anthropicApiKey,
    },
    {
      id: "salla",
      name: "سلة (Salla)",
      usedFor: "كل بيانات المتجر الحقيقية: المنتجات، الطلبات، العملاء، المخزون، التحليلات",
      freeTier: "مجانية كجزء من حساب تاجر سلة — لا تكلفة إضافية على واجهة الـ API",
      requiresApiKey: true,
      envVar: "SALLA_ACCESS_TOKEN",
      officialUrl: "https://salla.partners",
      configured: isSallaConfigured(),
    },
    {
      id: "whatsapp",
      name: "واتساب بزنس (Meta Cloud API)",
      usedFor: "إرسال ردود فعلية للعميلات عبر واتساب (بعد موافقتك)",
      freeTier: "1000 محادثة خدمة عملاء مجانية شهريًا لكل رقم حسب سياسة ميتا الرسمية، وما بعدها برسوم",
      requiresApiKey: true,
      envVar: "WHATSAPP_ACCESS_TOKEN",
      officialUrl: "https://developers.facebook.com/docs/whatsapp",
      configured: isWhatsAppConfigured(),
    },
    {
      id: "instagram-messaging",
      name: "Instagram Messaging (Meta Graph API)",
      usedFor: "قراءة رسائل/تعليقات إنستغرام والرد عليها فعليًا (بعد موافقتك الصريحة)",
      freeTier: "الواجهة نفسها مجانية؛ الإرسال بكميات كبيرة يحتاج موافقة Meta App Review على صلاحية instagram_business_manage_messages، وحد 200 رسالة تلقائية/ساعة لكل حساب",
      requiresApiKey: true,
      envVar: "META_PAGE_ACCESS_TOKEN + INSTAGRAM_BUSINESS_ACCOUNT_ID",
      officialUrl: "https://developers.facebook.com/docs/messenger-platform/instagram",
      configured: isInstagramConfigured(),
    },
    {
      id: "tiktok-comments",
      name: "TikTok for Business API (تعليقات)",
      usedFor: "الرد الفعلي على تعليقات تيك توك (بعد موافقتك الصريحة)",
      freeTier: "الواجهة البرمجية نفسها مجانية لحسابات الأعمال المرتبطة",
      requiresApiKey: true,
      envVar: "TIKTOK_ACCESS_TOKEN",
      officialUrl: "https://business-api.tiktok.com/portal/docs",
      configured: isTikTokCommentsConfigured(),
    },
    {
      id: "youtube",
      name: "YouTube Data API",
      usedFor: "تحليل فيديوهات واتجاهات المحتوى، أبحاث تسويقية",
      freeTier: "حصة مجانية يومية رسمية من Google (10,000 وحدة/يوم تقريبًا)",
      requiresApiKey: true,
      envVar: "YOUTUBE_API_KEY",
      officialUrl: "https://console.cloud.google.com",
      configured: !!env.youtube.apiKey,
    },
    {
      id: "meta-ads",
      name: "Meta Marketing API (إنستغرام / فيسبوك)",
      usedFor: "تشغيل حملات إعلانية فعلية (بعد موافقتك الصريحة)",
      freeTier: "الواجهة البرمجية نفسها مجانية — التكلفة الوحيدة هي ميزانية الإعلان التي تحددينها",
      requiresApiKey: true,
      envVar: "META_PAGE_ACCESS_TOKEN",
      officialUrl: "https://developers.facebook.com/docs/marketing-apis",
      configured: isMetaConfigured(),
    },
    {
      id: "tiktok-ads",
      name: "TikTok for Business API",
      usedFor: "تشغيل حملات إعلانية فعلية على تيك توك (بعد موافقتك الصريحة)",
      freeTier: "الواجهة البرمجية نفسها مجانية — التكلفة الوحيدة هي ميزانية الإعلان",
      requiresApiKey: true,
      envVar: "TIKTOK_ACCESS_TOKEN",
      officialUrl: "https://business-api.tiktok.com",
      configured: isTikTokConfigured(),
    },
    {
      id: "snapchat-ads",
      name: "Snapchat Marketing API",
      usedFor: "تشغيل حملات إعلانية فعلية على سناب شات (بعد موافقتك الصريحة)",
      freeTier: "الواجهة البرمجية نفسها مجانية — التكلفة الوحيدة هي ميزانية الإعلان",
      requiresApiKey: true,
      envVar: "SNAPCHAT_ACCESS_TOKEN",
      officialUrl: "https://businesshelp.snapchat.com",
      configured: isSnapchatConfigured(),
    },
    {
      id: "tavily",
      name: "Tavily",
      usedFor: "البحث في الإنترنت وجمع المعلومات (اتجاهات موضة، أسعار منافسين، أخبار)",
      freeTier: "1,000 عملية بحث مجانية شهريًا بدون بطاقة ائتمان، بحد أقصى 100 طلب/دقيقة",
      requiresApiKey: true,
      envVar: "TAVILY_API_KEY",
      officialUrl: "https://tavily.com",
      configured: isTavilyConfigured(),
    },
    {
      id: "mymemory",
      name: "MyMemory",
      usedFor: "ترجمة نصوص قصيرة (حتى 500 حرف) بين اللغات — للرد على العميلات الدوليات أو ترجمة الأوصاف",
      freeTier: "5,000 حرف يوميًا بدون أي تسجيل، حتى ~10,000 كلمة يوميًا بإضافة بريد تواصل (ليس مفتاحًا سريًا)",
      requiresApiKey: false,
      envVar: "MYMEMORY_CONTACT_EMAIL (اختياري لرفع الحد)",
      officialUrl: "https://mymemory.translated.net",
      configured: true,
    },
    {
      id: "huggingface",
      name: "Hugging Face Inference API",
      usedFor: "توليد صور جديدة من وصف نصي — أفكار ومسودات تسويقية بصرية",
      freeTier: "طبقة مجانية بحدود غير ثابتة (تختلف حسب ازدحام النموذج) — مناسبة للتجربة والمسودات وليست للإنتاج الثقيل",
      requiresApiKey: true,
      envVar: "HUGGINGFACE_API_TOKEN",
      officialUrl: "https://huggingface.co/settings/tokens",
      configured: isHuggingFaceConfigured(),
    },
    {
      id: "removebg",
      name: "remove.bg",
      usedFor: "إزالة خلفية صور المنتجات تلقائيًا",
      freeTier: "معاينات غير محدودة بدقة منخفضة (~0.25 ميجابكسل)؛ الدقة الكاملة مدفوعة",
      requiresApiKey: true,
      envVar: "REMOVEBG_API_KEY",
      officialUrl: "https://www.remove.bg/api",
      configured: isRemoveBgConfigured(),
    },
  ];
}
