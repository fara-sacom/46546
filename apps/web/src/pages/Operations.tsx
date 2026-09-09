import { useEffect, useState } from "react";
import { api } from "../api";
import { ACTION_STATUS_LABEL as STATUS_LABEL } from "../labels";

export default function Operations() {
  const [actions, setActions] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("");

  async function refresh() {
    const { actions } = await api.allActions(filter || undefined);
    setActions(actions);
  }

  useEffect(() => {
    refresh();
  }, [filter]);

  return (
    <div>
      <h2>سجل العمليات</h2>
      <div className="panel">
        <label>تصفية بالحالة: </label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">الكل</option>
          {Object.keys(STATUS_LABEL).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </div>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>الأداة</th>
              <th>الوصف</th>
              <th>الحالة</th>
              <th>طلبها</th>
              <th>قرّرها</th>
              <th>الوقت</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a.id} style={a.status === "FAILED" ? { color: "var(--danger)" } : undefined}>
                <td>{a.tool?.name}</td>
                <td>{a.summary}</td>
                <td>{STATUS_LABEL[a.status] ?? a.status}</td>
                <td>{a.requestedBy?.name ?? "الوكيل"}</td>
                <td>{a.decidedBy?.name ?? "-"}</td>
                <td>{new Date(a.createdAt).toLocaleString("ar-SA")}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {actions.length === 0 && <p className="muted">لا عمليات مسجّلة بعد.</p>}
      </div>
    </div>
  );
}
