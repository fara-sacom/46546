# FARA AI Agent

وكيل ذكاء اصطناعي فعلي لإدارة ومساعدة متجر **FARA STORE** (مبني على منصة سلة/Salla): منتجات، طلبات ومبيعات، خدمة عملاء (عربي سعودي راقٍ + إنجليزي)، تسويق وإعلانات، وتكامل قنوات (واتساب/إنستغرام/تيك توك/سناب شات/يوتيوب) - مع نظام صلاحيات **READ / DRAFT / ACTION** ولوحة تحكم للموافقات وسجل تدقيق كامل.

راجعي **[`docs/fara-agent-architecture.md`](docs/fara-agent-architecture.md)** للبنية الكاملة وطريقة التشغيل.

للسياق التجاري (من نحن، ماذا نبيع، كيف نعمل) راجعي **[`business-overview.md`](business-overview.md)**، والذي بُني باتباع **[`docs/new-hire-setup-kit.md`](docs/new-hire-setup-kit.md)** — طريقة موحّدة لتوثيق أي قسم/مهمة جديدة وتحويلها لاحقًا إلى Claude Code skill.

## بنية المشروع

```
apps/api           خدمة الوكيل (Node.js + TypeScript + Express + Prisma + Anthropic SDK)
apps/web            لوحة تحكم FARA (React + Vite)
docs/                توثيق البنية وطريقة توثيق الأقسام (new-hire-setup-kit)
business-overview.md  نظرة عامة على عمل FARA STORE
sales/, marketing/, support/  ملفات workflow لكل قسم يعمل عليه الوكيل فعليًا
.claude/skills/       مهارات Claude Code المبنية من الـ workflows بعد استقرارها
```

## تشغيل سريع

```bash
npm install
cp apps/api/.env.example apps/api/.env   # عبّي المفاتيح المتاحة لديك
npm run db:migrate --workspace apps/api
npm run db:seed --workspace apps/api
npm run dev:api
npm run dev:web
```
