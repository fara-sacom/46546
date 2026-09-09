import { useEffect, useState } from "react";
import { api } from "../api";

export default function Chat() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    refreshConversations().catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (activeId) refreshMessages(activeId).catch((e) => setError(e.message));
  }, [activeId]);

  async function newConversation() {
    const { conversation } = await api.createConversation({ channel: "DASHBOARD", language: "ar" });
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
      <div className="panel" style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="btn primary" onClick={newConversation}>محادثة جديدة</button>
        <select
          value={activeId ?? ""}
          onChange={(e) => setActiveId(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 8 }}
        >
          {conversations.map((c) => (
            <option key={c.id} value={c.id}>
              {c.channel} · {c.language} · {new Date(c.createdAt).toLocaleString("ar-SA")}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="panel" style={{ borderColor: "var(--danger)" }}>
          <strong>خطأ:</strong> {error}
        </div>
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
                    {tc.name} ({tc.status})
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
          {sending ? "..." : "إرسال"}
        </button>
      </div>
    </div>
  );
}
