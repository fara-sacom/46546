---
name: ad-candidate-brief
description: Pick the best products to advertise using real Salla sales data and draft a campaign brief (title, copy, proposed budget), following the marketing/workflows/ad-candidate-brief.md workflow. Use when a marketing staff member asks for ad candidates, wants a campaign brief for a product, or asks what to advertise next.
---

# تجهيز موجز إعلاني لمنتج مرشّح

اتبعي بالضبط `marketing/workflows/ad-candidate-brief.md` في هذا المستودع.

## نقطة مهمة: كيف تُنفَّذ هذه المهارة فعليًا

`marketing.suggestAdCandidates`, `marketing.prepareCampaignBrief`, `marketing.launchCampaign`, `salla.analytics.salesSummary` **ليست أدوات متاحة لكِ مباشرة هنا**. هذه أسماء أدوات مسجّلة فقط داخل وكيل FARA API (`apps/api/src/agent/toolRegistry.ts`)، ولا يوجد إعداد MCP يعرّضها لكِ في Claude Code. لا تدّعي استدعاء أي منها مباشرة، ولا تخترعي أرقام مبيعات من عندك.

الجسر الحقيقي هو REST API لخدمة `apps/api` (يجب أن تكون تعمل فعليًا، افتراضيًا على `:8787`):

1. أنشئي محادثة أو استخدمي واحدة قائمة: `POST /api/conversations` بترويسة `X-FARA-Staff-Key: <مفتاح الموظف>`.
2. مرّري طلب موظف التسويق لوكيل FARA نفسه (وهو من يملك فعليًا أدوات `marketing.*`/`salla.*`):
   ```bash
   curl -sS -X POST "http://localhost:8787/api/conversations/$CONVERSATION_ID/chat" \
     -H "X-FARA-Staff-Key: $FARA_STAFF_KEY" \
     -H "Content-Type: application/json" \
     -d '{"text": "رشحي لي منتجات للإعلان بناءً على مبيعات آخر 30 يوم"}'
   ```
3. اقرئي حقل `reply` من الاستجابة — هو ترشيح الوكيل الفعلي المبني على `salesSummary` الحقيقي، وليس تخمينك.
4. لتجهيز الموجز الفعلي بعد اختيار المنتج، أرسلي طلبًا تاليًا لنفس المحادثة (نفس endpoint) يطلب من الوكيل `marketing.prepareCampaignBrief` — مثل "جهزي موجز حملة لهذا المنتج على إنستغرام بميزانية 50 ريال يوميًا".
5. **فجوة حالية**: لا توجد شاشة `CampaignDraft` في لوحة التحكم — اعرضي نص الموجز الناتج من `reply` مباشرة على المستخدم للمراجعة، ولا تدّعي وجود شاشة مراجعة منفصلة.
6. لا تستدعي تشغيل حملة فعلية نيابة عن المستخدم أبدًا. إن ظهر في الاستجابة `status: "pending_approval"`، أخبريه بوضوح أن الحملة بانتظار موافقة ADMIN عبر لوحة التحكم أو `POST /api/actions/:id/approve`، ولا تدّعي أنها انطلقت.
7. إن لم تكن خدمة `apps/api` تعمل أو المفاتيح غير مضبوطة (Salla، Meta/TikTok/Snapchat Marketing APIs، YouTube API)، أخبري المستخدم بوضوح أن الترشيح غير ممكن الآن بدل اختراع أرقام مبيعات أو منتجات.

## Access needed
هذه المهارة عديمة الفائدة عمليًا بدون:
- **خدمة `apps/api` قيد التشغيل فعليًا** (`npm run dev:api`) — الجسر الوحيد لأدوات الوكيل من داخل Claude Code.
- **مفتاح موظف صالح** (`X-FARA-Staff-Key`).
- **Salla Admin API v2** مُهيّأ — بدونه لا توجد بيانات مبيعات حقيقية للترشيح منها.
- حسابات إعلانية مُهيّأة (Meta/TikTok/Snapchat Marketing APIs) إذا كان الهدف تشغيل الحملة فعليًا لاحقًا — غير مطلوبة فقط لتجهيز موجز DRAFT.

## متى تُستخدم هذه المهارة
- عند طلب موظف تسويق "أي منتج نعلن عنه؟" أو "جهزي موجز حملة لمنتج كذا".
- لا تُستخدم لتشغيل حملة فعلية أو صرف ميزانية — ذلك يتطلب موافقة ADMIN صريحة خارج نطاق هذه المهارة.
