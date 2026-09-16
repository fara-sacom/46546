---
name: whatsapp-customer-reply
description: Draft and send a WhatsApp reply to a FARA STORE customer, following the support/workflows/whatsapp-customer-reply.md workflow. Use when a staff member asks to reply to a customer's WhatsApp message, check an order status for a customer reply, or handle an incoming WhatsApp inquiry.
---

# الرد على عميلة عبر واتساب

اتبعي بالضبط `support/workflows/whatsapp-customer-reply.md` في هذا المستودع. هذا ملخص تشغيلي سريع:

1. اقرئي رسالة العميلة واكتشفي لغتها (عربي/إنجليزي).
2. إن احتاج الرد بيانات حقيقية (حالة طلب، سعر، مخزون)، استعلمي أولًا عبر أدوات READ المناسبة (`salla.orders.get`, `salla.orders.history`, `salla.products.search`, ...). لا تجيبي من الذاكرة أو تخمّني أبدًا.
3. إن تعذّر الوصول لأي تكامل، أخبري المستخدم بوضوح أن التحقق غير ممكن الآن بدل افتراض إجابة.
4. جهّزي مسودة الرد عبر `whatsapp.draftReply` بنبرة FARA: سعودية راقية ودافئة بالعربية، أو مهنية ودودة بالإنجليزية.
5. لا تُرسلي أي رسالة فعلية بنفسك — إرسال `whatsapp.sendMessage` هو ACTION ولا يُنفَّذ إلا بعد موافقة موظف ADMIN صريحة عبر لوحة التحكم.
6. إذا استُدعيت `whatsapp.sendMessage`، اشرحي فورًا للمستخدم ماذا سيُرسَل بالضبط وأنه بانتظار الموافقة، ولا تدّعي أن الرسالة وصلت قبل ظهور نتيجة تنفيذ فعلية.

## Access needed
هذه المهارة عديمة الفائدة عمليًا بدون هذين التكاملين متصلين وفعّالين (راجعي `apps/api/.env`):
- **Meta WhatsApp Cloud API** — بدونه لا يمكن إرسال أي رد فعلي، فقط تجهيز مسودات.
- **Salla Admin API v2** — بدونه لا يمكن التحقق من حالة طلب أو سعر حقيقي، والرد يصبح تخمينًا بدل حقيقة.

## متى تُستخدم هذه المهارة
- عند وصول رسالة واتساب من عميلة وطلب موظف صياغة رد.
- عند طلب "جاوبي على استفسار العميلة عن طلبها رقم كذا" أو ما شابه.
- لا تُستخدم لتعديل الأسعار أو المخزون — ذلك خارج نطاقها.
