import { useEffect, useState } from "react";
import { api } from "../api";

export default function AuditLog() {
  const [entries, setEntries] = useState<any[]>([]);
  const [onlyErrors, setOnlyErrors] = useState(false);

  useEffect(() => {
    api.auditLog().then((r) => setEntries(r.entries));
  }, []);

  const shown = onlyErrors ? entries.filter((e) => e.result === "failed") : entries;

  return (
    <div>
      <h2>سجل التدقيق (Audit Log)</h2>
      <div className="panel">
        <label>
          <input type="checkbox" checked={onlyErrors} onChange={(e) => setOnlyErrors(e.target.checked)} /> عرض الأخطاء والتنبيهات فقط
        </label>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>الوقت</th>
              <th>من طلب</th>
              <th>ماذا طلب</th>
              <th>الأدوات</th>
              <th>المستوى</th>
              <th>النتيجة</th>
              <th>خطأ</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((e) => (
              <tr key={e.id} style={e.result === "failed" ? { color: "var(--danger)" } : undefined}>
                <td>{new Date(e.createdAt).toLocaleString("ar-SA")}</td>
                <td>{e.actor?.name ?? e.actorLabel}</td>
                <td style={{ maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{e.requestText}</td>
                <td>{JSON.parse(e.toolsUsed).join(", ")}</td>
                <td><span className={`badge ${e.tier}`}>{e.tier}</span></td>
                <td>{e.result}</td>
                <td>{e.errorText ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {shown.length === 0 && <p className="muted">لا سجلات بعد.</p>}
      </div>
    </div>
  );
}
