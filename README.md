# FARA AI Agent

وكيل ذكاء اصطناعي فعلي لإدارة ومساعدة متجر **FARA STORE** (مبني على منصة سلة/Salla): منتجات، طلبات ومبيعات، خدمة عملاء (عربي سعودي راقٍ + إنجليزي)، تسويق وإعلانات، وتكامل قنوات (واتساب/إنستغرام/تيك توك/سناب شات/يوتيوب) - مع نظام صلاحيات **READ / DRAFT / ACTION** ولوحة تحكم للموافقات وسجل تدقيق كامل.

راجعي **[`docs/fara-agent-architecture.md`](docs/fara-agent-architecture.md)** للبنية الكاملة وطريقة التشغيل.

## بنية المشروع

```
apps/api   خدمة الوكيل (Node.js + TypeScript + Express + Prisma + Anthropic SDK)
apps/web   لوحة تحكم FARA (React + Vite)
docs/      توثيق البنية
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
