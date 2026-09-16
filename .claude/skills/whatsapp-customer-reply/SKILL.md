---
name: whatsapp-customer-reply
description: Draft and send a WhatsApp reply to a FARA STORE customer, following the support/workflows/whatsapp-customer-reply.md workflow. Use when a staff member asks to reply to a customer's WhatsApp message, check an order status for a customer reply, or handle an incoming WhatsApp inquiry.
---

# الرد على عميلة عبر واتساب

اتبعي بالضبط `support/workflows/whatsapp-customer-reply.md` في هذا المستودع.

## نقطة مهمة: كيف تُنفَّذ هذه المهارة فعليًا

`salla.orders.get`, `whatsapp.draftReply`, `whatsapp.sendMessage` وما شابهها **ليست أدوات متاحة لكِ مباشرة هنا**. هذه أسماء أدوات مسجّلة فقط داخل وكيل FARA API الخاص (`apps/api/src/agent/toolRegistry.ts`) الذي يشغّل حلقة Tool-Use الخاصة به مع Claude، ولا يوجد إعداد MCP أو جسر آخر يعرّضها لكِ في Claude Code. لا تدّعي استدعاء أي منها مباشرة.

الجسر الحقيقي المتاح فعليًا هو REST API الخاص بـ FARA (يجب أن تكون خدمة `apps/api` تعمل، افتراضيًا على المنفذ من `apps/api/.env` أو `:8787`):

1. أنشئي أو استخدمي محادثة موجودة:
   `POST /api/conversations` مع ترويسة `X-FARA-Staff-Key: <مفتاح الموظف>` — أو استخدمي `conversationId` محادثة واتساب الواردة أصلًا إن كانت موجودة (`GET /api/conversations`).
2. مرّري نص طلب الموظف/العميلة لوكيل FARA نفسه (وهو من يملك فعليًا أدوات `salla.*`/`whatsapp.*`):
   `POST /api/conversations/:id/chat` بنفس الترويسة، والجسم `{"text": "..."}`
   مثال:
   ```bash
   curl -sS -X POST "http://localhost:8787/api/conversations/$CONVERSATION_ID/chat" \
     -H "X-FARA-Staff-Key: $FARA_STAFF_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "جهزي مسودة رد لاستفسار العميلة عن حالة طلبها رقم 10245"}'
   ```
3. الوكيل الحقيقي (خلف هذا الـ endpoint) هو من يستعلم عبر أدوات READ ويجهّز المسودة عبر `whatsapp.draftReply` وفق قواعده الخاصة — النتيجة تعود في حقل `reply` من استجابة الطلب. أسئلة السياسة (استبدال، شحن، دفع، كود خصم) يجيب عليها الوكيل من `support/knowledge/whatsapp-policy.md` (مضمَّن في system prompt الخاص به)، وليس من تخمينك أنتِ.
4. لا تستدعي مسارًا يشغّل `whatsapp.sendMessage` (ACTION) نيابة عن الموظف بدون موافقته الصريحة أولًا — إن ظهر أن الوكيل أنشأ إجراء ACTION بانتظار الموافقة (`status: "pending_approval"` في الاستجابة)، أخبري المستخدم بوضوح أنه بانتظار موافقة ADMIN عبر لوحة التحكم أو `POST /api/actions/:id/approve`، ولا تدّعي أن الرسالة أُرسلت.
5. إن لم تكن خدمة `apps/api` تعمل أو المفاتيح غير مضبوطة (`X-FARA-Staff-Key` غير صالح، أو `ANTHROPIC_API_KEY` غير مضبوط)، أخبري المستخدم بوضوح أن هذه المهارة غير قابلة للتنفيذ الآن بدل تخمين رد.

## Access needed
هذه المهارة عديمة الفائدة عمليًا بدون:
- **خدمة `apps/api` قيد التشغيل فعليًا** (`npm run dev:api`) — هي الجسر الوحيد الحقيقي لأدوات الوكيل من داخل Claude Code.
- **مفتاح موظف صالح** (`X-FARA-Staff-Key`، يُنشأ عبر `npm run db:seed --workspace apps/api`).
- **Meta WhatsApp Cloud API** مُهيّأ في `apps/api/.env` — بدونه لا يمكن إرسال أي رد فعلي، فقط تجهيز مسودات.
- **Salla Admin API v2** مُهيّأ في `apps/api/.env` — بدونه لا يمكن التحقق من حالة طلب أو سعر حقيقي.

## متى تُستخدم هذه المهارة
- عند وصول رسالة واتساب من عميلة وطلب موظف صياغة رد، وخدمة `apps/api` تعمل فعليًا.
- عند طلب "جاوبي على استفسار العميلة عن طلبها رقم كذا" أو ما شابه.
- لا تُستخدم لتعديل الأسعار أو المخزون — ذلك خارج نطاقها.
- لا تُستخدم إن لم يكن بالإمكان الوصول إلى `apps/api` — أخبري المستخدم بذلك صراحة بدل محاكاة تنفيذها.
