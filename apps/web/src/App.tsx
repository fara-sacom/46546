import { useEffect, useState } from "react";
import { api, getStaffKey, setStaffKey } from "./api";
import Chat from "./pages/Chat";
import PendingApprovals from "./pages/PendingApprovals";
import Operations from "./pages/Operations";
import AuditLog from "./pages/AuditLog";
import Tools from "./pages/Tools";

const TABS = [
  { id: "chat", label: "المحادثات" },
  { id: "approvals", label: "بانتظار الموافقة" },
  { id: "operations", label: "سجل العمليات" },
  { id: "audit", label: "سجل التدقيق" },
  { id: "tools", label: "الأدوات" },
];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [keyInput, setKeyInput] = useState(getStaffKey());
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth(null));
  }, [tab]);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>FARA AI Agent</h1>
        <div className="subtitle">وكيل متجر FARA STORE الذكي</div>
        {TABS.map((t) => (
          <button key={t.id} className={`nav-item ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
        <hr style={{ borderColor: "var(--border)", margin: "16px 0" }} />
        {health && (
          <div style={{ fontSize: 12 }}>
            <div>
              الوكيل: <span className={`badge ${health.agentConfigured ? "ok" : "missing"}`}>{health.agentConfigured ? "مفعّل" : "بدون مفتاح"}</span>
            </div>
            {Object.entries(health.integrations).map(([k, v]) => (
              <div key={k}>
                {k}: <span className={`badge ${v ? "ok" : "missing"}`}>{v ? "متصل" : "غير مُهيّأ"}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
      <main className="main">
        <div className="key-bar">
          <input
            placeholder="مفتاح الموظف (X-FARA-Staff-Key)"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
          />
          <button className="btn" onClick={() => setStaffKey(keyInput)}>
            حفظ المفتاح
          </button>
        </div>

        {tab === "chat" && <Chat />}
        {tab === "approvals" && <PendingApprovals />}
        {tab === "operations" && <Operations />}
        {tab === "audit" && <AuditLog />}
        {tab === "tools" && <Tools />}
      </main>
    </div>
  );
}
