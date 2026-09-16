# New-Hire Setup Kit — كيف يُبنى سياق FARA لـ Claude

هذا التوثيق يشرح الطريقة المتّبعة في هذا المستودع لبناء سياق عمل (context) واضح لـ Claude حول عمل FARA STORE، خطوة بخطوة، والملفات الناتجة عنها فعليًا حتى الآن. الهدف تكرار نفس الطريقة كلما احتجنا توثيق مهمة مؤلمة جديدة، لا إعادة اختراعها كل مرة.

## المبدأ
مجلد واحد لكل قسم يؤلم فعليًا (مبيعات، تسويق، دعم)، وملف واحد لكل مهمة داخل القسم، وليس تصميم هيكل تنظيمي مسبق. المهمة التالية المزعجة تأخذ ملفها الخاص، والمجلد يكبر تدريجيًا بشكل عمل FARA الفعلي.

## الخطوات

### 1. نظرة عامة على العمل
`business-overview.md` في جذر المستودع. يغطي 7 أقسام ثابتة (هوية الشركة، نموذج الإيراد، عرض المنتجات، الفريق والعمليات، الموقع السوقي، النمو، أولويات 90 يوم). كل رقم غير متوفر فعليًا في الكود (إيراد، CAC، LTV، أولويات الربع) تُرك صراحة كـ "غير متوفر — يُعبَّأ من صاحب المتجر" بدل اختلاقه، اتساقًا مع قاعدة FARA نفسها بمنع اختلاق البيانات (انظر `apps/api/src/agent/systemPrompt.ts`).

لتحديثه بمدخلات بشرية حقيقية، استخدمي برومبت "Business Overview Interview" (نسخة أصلية في نهاية هذا الملف) مع Claude، وأعيدي حفظ الناتج في `business-overview.md`.

### 2. تقسيم حسب القسم الذي يؤلم
كل قسم = مجلد فيه `workflows/`. حاليًا:
- `sales/workflows/`
- `marketing/workflows/`
- `support/workflows/`

هذه الأقسام اختيرت لأنها تطابق التكاملات الفعلية الثلاثة في `apps/api/src/integrations/` (سلة، تسويق/إعلانات، واتساب) — وليست هيكلًا تنظيميًا مُتخيَّلًا.

### 3. خريطة كل مهمة على حدة
مهمة واحدة فعلية داخل قسم واحد → ملف واحد بعناوين ثابتة: Responsibilities، What starts it، How it runs، What success looks like، Access needed. الأمثلة الحالية:
- `support/workflows/whatsapp-customer-reply.md`
- `marketing/workflows/ad-candidate-brief.md`
- `sales/workflows/low-stock-restock-alert.md`

كل خطوة في "How it runs" مربوطة باسم أداة حقيقي من `apps/api/src/integrations/*/tools.ts` — لا خطوات وهمية.

### 4. تحويلها إلى Skill
بعد أن يستقر workflow (تكرر تشغيله وتوقفت الأخطاء عن الظهور)، يتحول إلى مهارة Claude Code فعلية في `.claude/skills/<اسم>/SKILL.md`. المثال الحالي: `.claude/skills/whatsapp-customer-reply/SKILL.md`، مبني مباشرة من `support/workflows/whatsapp-customer-reply.md`.

قسم "Access needed" في أي workflow هو قائمة التحقق قبل تفعيل الـ skill: مهارة الرد على واتساب بلا اتصال WhatsApp Cloud API و Salla فعلي هي ملف منسّق بلا أي قيمة عملية.

## الخطوة التالية
المهمة المؤلمة التالية تأخذ ملفها الخاص في `[department]/workflows/[workflow-name].md` بنفس الطريقة، ثم تتحول لمهارة عند الاستقرار.

---

## البرومبتات الأصلية (للرجوع إليها عند إعادة تشغيل الخطوات 1 و3 مع مدخلات بشرية جديدة)

### Business Overview Interview
راجعي محتوى `business-overview.md` — الأقسام السبعة نفسها. لإعادة توليد القسم بمدخلات حقيقية جديدة، اطلبي من Claude إجراء مقابلة من 7 أقسام (سؤال أو سؤالين لكل قسم، الانتظار للإجابة قبل الانتقال، طلب توضيح للإجابات المبهمة) ثم توليد الوثيقة النهائية بنفس العناوين السبعة، وحفظها في `business-overview.md` مع سطر ختامي "Last updated: [التاريخ]".

### Workflow Mapping Interview
لتوثيق مهمة جديدة، اطلبي من Claude قراءة `business-overview.md` أولًا (لتفادي إعادة سؤال ما هو مُجاب فعلًا فيه)، ثم طرح 4 أسئلة بالترتيب مع الانتظار للإجابة: (1) ما المهمة، وأي قسم تتبعه؟ (2) ما الذي يبدأها؟ (3) كيف تُنفَّذ حاليًا خطوة بخطوة؟ (4) كيف يبدو التنفيذ الصحيح والخاطئ؟ ثم كتابة الملف بالعناوين الخمسة (Responsibilities, What starts it, How it runs, What success looks like, Access needed) وحفظه في `[department]/workflows/[workflow-name].md`.
