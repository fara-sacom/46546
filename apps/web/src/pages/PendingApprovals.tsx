import { useEffect, useState } from "react";
import { api } from "../api";

export default function PendingApprovals() {
  const [actions, setActions] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      const { actions } = await api.pendingActions();
      setActions(actions);
    } catch (e: any) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, []);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    try {
      if (approve) await api.approve(id);
      else await api.reject(id);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>الإجراءات التي تنتظر الموافقة</h2>
      {error && <div className="panel" style={{ borderColor: "var(--danger)" }}>{error}</div>}
      {actions.length === 0 && <p className="muted">لا توجد إجراءات حساسة بانتظار الموافقة حاليًا.</p>}
      {actions.map((a) => (
        <div className="panel" key={a.id}>
          <span className={`badge ${a.tier}`}>{a.tier}</span>
          <strong>{a.tool?.name}</strong>
          <p>{a.summary}</p>
          <pre style={{ background: "var(--bg)", padding: 8, borderRadius: 8, fontSize: 12, overflowX: "auto" }}>
            {JSON.stringify(JSON.parse(a.payloadInput), null, 2)}
          </pre>
          <p className="muted">طُلب في {new Date(a.createdAt).toLocaleString("ar-SA")} بواسطة {a.requestedBy?.name ?? "الوكيل"}</p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn primary" disabled={busyId === a.id} onClick={() => decide(a.id, true)}>
              موافقة وتنفيذ
            </button>
            <button className="btn danger" disabled={busyId === a.id} onClick={() => decide(a.id, false)}>
              رفض
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
