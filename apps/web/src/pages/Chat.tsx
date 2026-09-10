import { useEffect, useState } from "react";
import { api } from "../api";
import { CHANNEL_LABEL, LANGUAGE_LABEL, TOOL_CALL_STATUS_LABEL, tr } from "../labels";

export default function Chat() {
  const [assistants, setAssistants] = useState<any[]>([]);
  const [newAssistantType, setNewAssistantType] = useState("PERSONAL");
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const activeAssistantName = assistants.find((a) => a.id === activeConversation?.assistantType)?.name;

  async function refreshConversations() {
    const { conversations } = await api.conversations();
    setConversations(conversations);
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }

  async function refreshMessages(id: string) {
    const { messages } = await api.messages(id);
    setMessages(messages);
  }

  useEffect(() => {
    api.assistants().then((r) => setAssistants(r.assistants)).catch(() => setAssistants([]));
    refreshConversations().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (activeId) refreshMessages(activeId).catch((e) => setError(e.message));
  }, [activeId]);

  async function newConversation() {
    const { conversation } = await api.createConversation({ channel: "DASHBOARD", assistantType: newAssistantType, language: "ar" });
    setConversations((c) => [conversation, ...c]);
    setActiveId(conversation.id);
    setMessages([]);
  }

  async function send() {
    if (!activeId || !text.trim()) return;
    setSending(true);
    setError(null);
    const outgoing = text;
    setText("");
    setMessages((m) => [...m, { id: "tmp", role: "USER", content: outgoing }]);
    try {
      await api.chat(activeId, outgoing);
      await refreshMessages(activeId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="panel">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
          <select value={newAssistantType} onChange={(e) => setNewAssistantType(e.target.value)} style={{ padding: 8, borderRadius: 8 }}>
            {assistants.map((a) => (
              <option key={a.id} value={a.id} title={a.description}>
                {a.name}
              </option>
            ))}
          </select>
          <button className="btn primary" onClick={newConversation}>
            محادثة جديدة
          </button>
        </div>
        <select value={activeId ?? ""} onChange={(e) => setActiveId(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8 }}>
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {assistants.find((a) => a.id === c.assistantType)?.name ?? c.assistantType} · {tr(CHANNEL_LABEL, c.channel)} ·{" "}
              {tr(LANGUAGE_LABEL, c.language)} · {new Date(c.createdAt).toLocaleString("ar-SA")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <strong>خطأ:</strong> {error}
        </div>
      )}

      {activeAssistantName && (
        <p className="muted" style={{ marginTop: -8 }}>
          تتحدثين الآن مع: <strong style={{ color: "var(--accent)" }}>{activeAssistantName}</strong>
        </p>
      )}

      <div className="panel">
        {messages.length === 0 && <p className="muted">لا رسائل بعد. ابدئي المحادثة مع FARA AI Agent.</p>}
        {messages.map((m) => (
          <div key={m.id}>
            <div className={`msg ${m.role}`}>{m.content}</div>
            {m.toolCallsJson && JSON.parse(m.toolCallsJson).length > 0 && (
              <div className="muted" style={{ marginBottom: 10 }}>
                الأدوات المستخدمة:{" "}
                {JSON.parse(m.toolCallsJson).map((tc: any, i: number) => (
                  <span key={i} className="badge" style={{ background: "var(--border)" }}>
                    {tc.name} — {tr(TOOL_CALL_STATUS_LABEL, tc.status)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          placeholder="اكتبي طلبك هنا... مثال: ما المنتجات قليلة المخزون؟"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          disabled={!activeId || sending}
        />
        <button className="btn primary" onClick={send} disabled={!activeId || sending}>
          {sending ? "جارٍ الإرسال…" : "إرسال"}
        </button>
      </div>
    </div>
  );
}
