import { useEffect, useState } from "react";
import { api } from "../api";

export default function AIServices() {
  const [services, setServices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.aiServices().then((r) => setServices(r.services)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h2>خدمات الذكاء الاصطناعي</h2>
      <p className="muted" style={{ marginBottom: 16 }}>
        كل خدمة يستخدمها الوكيل الآن أو يمكنه استخدامها بعد ضبط مفتاحها — بيانات مجانية/Free Tier محدَّثة، ويُنصح بالتحقق منها في صفحة تسعير كل خدمة قبل الاعتماد الكامل عليها لأنها تتغيّر مع الوقت.
      </p>
      {error && <div className="panel" style={{ borderColor: "var(--danger)" }}>{error}</div>}
      {services.map((s) => (
        <div className="panel" key={s.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <strong style={{ fontSize: 15 }}>{s.name}</strong>
            <span className={`badge ${s.configured ? "ok" : "missing"}`}>{s.configured ? "متصل" : "غير مُهيّأ"}</span>
          </div>
          <p style={{ margin: "0 0 6px" }}>
            <strong>تُستخدم في: </strong>
            {s.usedFor}
          </p>
          <p style={{ margin: "0 0 6px" }}>
            <strong>الخطة المجانية: </strong>
            {s.freeTier}
          </p>
          <p style={{ margin: 0 }} className="muted">
            {s.requiresApiKey ? `تحتاج مفتاح API: ${s.envVar}` : "لا تحتاج مفتاح API إجباريًا"}
            {" · "}
            <a href={s.officialUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
              الموقع الرسمي
            </a>
          </p>
        </div>
      ))}
      {services.length === 0 && !error && <p className="muted">جارٍ التحميل...</p>}
    </div>
  );
}
