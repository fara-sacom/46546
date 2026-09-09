# بنية FARA AI Agent

## نظرة عامة

FARA AI Agent وكيل ذكاء اصطناعي حقيقي (ليس Chatbot) لإدارة ومساعدة متجر **FARA STORE** المبني على منصة **سلة (Salla)**. يحوّل الطلبات الطبيعية (عربي/إنجليزي) إلى خطوات وأدوات فعلية عبر محرك تخطيط يستخدم Claude (Anthropic) مع Tool-Use، ولا ينفّذ أي إجراء حساس إلا بعد موافقة بشرية صريحة.

```
apps/api   → خدمة الوكيل: Agent Core + Tool Router + التكاملات + قاعدة البيانات + REST API
apps/web   → لوحة تحكم FARA (React + Vite): محادثات، موافقات، سجل عمليات، سجل تدقيق، أدوات
docs/      → هذا المستند
```

## المكوّنات

### 1. Agent Core (`apps/api/src/agent/core.ts`)
حلقة Tool-Use مع Claude (`AGENT_MODEL`, افتراضيًا `claude-sonnet-5`). يحمّل تاريخ المحادثة من قاعدة البيانات، يستدعي الأدوات المسجّلة عبر `routeToolCall`، ويكرر حتى تنتهي الحاجة للأدوات (حتى 8 جولات أدوات كحد أقصى لكل رسالة). الشخصية والقواعد الصارمة معرّفة في `agent/systemPrompt.ts` (عربية بأسلوب سعودي راقٍ + إنجليزية، ومنع اختلاق البيانات).

### 2. Tool Registry (`apps/api/src/agent/toolRegistry.ts`)
مصدر الحقيقة الوحيد لكل أداة متاحة للوكيل. كل أداة (`ToolDefinition`) تحمل: الاسم، التكامل، **المستوى (READ/DRAFT/ACTION)**، الوصف، مخطط الإدخال (JSON Schema يُرسَل لـ Claude)، ودالة التنفيذ. تتم مزامنته مع جدول `ToolRegistryEntry` في قاعدة البيانات ليظهر في لوحة التحكم.

### 3. Permission Engine / Tool Router (`apps/api/src/agent/router.ts`)
نقطة الإنفاذ الوحيدة لكل استدعاء أداة:
- **READ**: تنفيذ فوري، تسجيل في `AuditLog`.
- **DRAFT**: تنفيذ فوري لكنه لا يلمس أي نظام خارجي أبدًا (يكتب فقط سجلات مسودة محلية مثل `CustomerReplyDraft` أو `CampaignDraft`).
- **ACTION**: **لا يُستدعى handler الأداة إطلاقًا هنا.** بدلاً من ذلك يُنشأ سجل `AgentAction` بحالة `PENDING` ويُسجَّل في `AuditLog` بنتيجة `pending`. هذا هو الضمان البنيوي (وليس فقط تعليمة في الـ prompt) بأن أي إجراء حساس يتوقف قبل التنفيذ.

### 4. Approval Engine (`apps/api/src/approvals/service.ts`)
`approveAction` هو المكان الوحيد في كامل الكود الذي يستدعي فعليًا handler أداة ACTION - ولا يحدث ذلك إلا بعد موافقة موظف بصلاحية `ADMIN`. ينفّذ الأداة الحقيقية، يحدّث حالة `AgentAction` إلى `EXECUTED` أو `FAILED` حسب النتيجة الفعلية (لا نجاح وهمي أبدًا)، ويكتب سجل تدقيق كامل. `rejectAction` يسجّل الرفض دون أي تنفيذ.

### 5. التكاملات (`apps/api/src/integrations/*`)
- **Salla** (`salla/`): عميل REST حقيقي على `SALLA_API_BASE_URL` (Salla Admin API v2) بمفتاح `SALLA_ACCESS_TOKEN`. يغطي المنتجات (قراءة/بحث/SKU/تعديل/إنشاء)، المخزون، الطلبات وحالاتها وسجلّها، العملاء، التصنيفات، التقييمات، السلال المتروكة، والقوائم. `analytics.salesSummary` و`analytics.lowStockProducts` محسوبة من بيانات الطلبات/المنتجات الحقيقية مباشرة (لا يوجد endpoint تقارير عام موثّق في Salla Admin API v2، فتجنّبنا تخمين endpoint غير موثّق).
- **WhatsApp** (`whatsapp/`): Meta WhatsApp Cloud API. `draftReply` (DRAFT) يجهّز مسودة، `sendMessage` (ACTION) يرسل فعليًا بعد الموافقة. مسار Webhook وارد جاهز في `routes/webhooks.ts` — الرسائل الواردة تُمرَّر للوكيل لتحليلها/تجهيز مسودة، ولا يُرسل ردّ تلقائي أبدًا.
- **Social/Marketing** (`social/`): يوتيوب (قراءة حقيقية عبر YouTube Data API)، وMeta/TikTok/Snapchat Marketing APIs لتشغيل الحملات (ACTION فقط). `marketing.prepareCampaignBrief` (DRAFT) يجهّز فكرة/نص حملة دون نشر. `marketing.suggestAdCandidates` (READ) يحلّل بيانات مبيعات سلة الحقيقية لاقتراح منتجات للإعلان.

### 6. قاعدة البيانات (`apps/api/prisma/schema.prisma`)
SQLite للتطوير (`DATABASE_URL=file:./prisma/dev.db`)، جاهزة للتحويل لـ Postgres بتغيير سطرين فقط (لا استخدام لأي نوع بيانات خاص بـ SQLite). الجداول: `StaffUser`, `Conversation`, `Message`, `ToolRegistryEntry`, `AgentAction`, `AuditLog`, `CampaignDraft`, `CustomerReplyDraft`, `IntegrationCredential`.
بيانات المنتجات/الطلبات/العملاء نفسها **لا تُخزَّن محليًا أبدًا** - تُقرأ مباشرة من سلة في كل مرة لضمان عدم وجود بيانات قديمة أو وهمية.

### 7. REST API (`apps/api/src/routes/*`)
كل الطلبات (عدا `/api/health` والـ webhooks) تتطلب ترويسة `X-FARA-Staff-Key`. الموافقة/الرفض يتطلبان صلاحية `ADMIN`.

| المسار | الوصف |
|---|---|
| `GET /api/health` | حالة الوكيل وكل تكامل (مُفعّل/غير مُهيّأ) |
| `GET /api/tools` | سجل الأدوات وصلاحياتها |
| `GET/POST /api/conversations` | قائمة/إنشاء محادثة |
| `GET /api/conversations/:id/messages` | رسائل محادثة |
| `POST /api/conversations/:id/chat` | إرسال رسالة للوكيل وتشغيل دورة التخطيط/الأدوات |
| `GET /api/actions/pending` | الإجراءات بانتظار الموافقة |
| `GET /api/actions?status=` | كل الإجراءات (سجل العمليات) |
| `POST /api/actions/:id/approve` | موافقة وتنفيذ فعلي (ADMIN) |
| `POST /api/actions/:id/reject` | رفض (ADMIN) |
| `GET /api/audit-log` | سجل التدقيق الكامل |
| `GET/POST /webhooks/whatsapp` | تحقق واتساب + استقبال رسائل العملاء |

### 8. لوحة التحكم (`apps/web`)
React + Vite. تبويبات: المحادثات، بانتظار الموافقة، سجل العمليات، سجل التدقيق، الأدوات - بالإضافة لمؤشر حالة كل تكامل في الشريط الجانبي.

## تشغيل المشروع

```bash
npm install                       # من جذر المشروع (يثبّت apps/api و apps/web)
cp apps/api/.env.example apps/api/.env   # عبّي المفاتيح المتاحة لديك
npm run db:migrate --workspace apps/api  # أو db:push للتطوير السريع
npm run db:seed --workspace apps/api     # ينشئ أول مستخدم ADMIN ومفتاحه
npm run dev:api                    # يشغّل API على :8787
npm run dev:web                    # يشغّل لوحة التحكم على :5173 (Vite proxy على /api)
npm test --workspace apps/api      # الاختبارات
```

## الأمان

- كل أداة ACTION محصورة عبر `router.ts` - لا يوجد مسار كود آخر يستدعي handler أداة ACTION إلا `approveAction` بعد موافقة `ADMIN` موثّقة.
- المفاتيح السرية (Salla/WhatsApp/Meta/TikTok/Snapchat/Anthropic) في متغيرات بيئة فقط، لا تُخزَّن أبدًا في قاعدة البيانات (`IntegrationCredential.metadata` يخزّن حالة التهيئة فقط وليس القيم السرية).
- مصادقة الموظفين عبر مفتاح API مُجزَّأ (SHA-256) - لا يُخزَّن المفتاح الخام أبدًا.
- كل عملية (قراءة/مسودة/إجراء) تُسجَّل في `AuditLog` مع من طلبها، ماذا طلب، الأدوات المستخدمة، التغييرات، الوقت، والنتيجة.
