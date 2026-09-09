const KEY_STORAGE = "fara.staffApiKey";

export function getStaffKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}
export function setStaffKey(key: string) {
  localStorage.setItem(KEY_STORAGE, key);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-FARA-Staff-Key": getStaffKey(),
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as any)?.error ?? `HTTP ${res.status}`);
  return body as T;
}

export const api = {
  health: () => request<{ status: string; agentConfigured: boolean; integrations: Record<string, boolean> }>("/health"),
  tools: () => request<{ tools: any[] }>("/tools"),
  conversations: () => request<{ conversations: any[] }>("/conversations"),
  createConversation: (data: { channel?: string; language?: string; customerRef?: string }) =>
    request<{ conversation: any }>("/conversations", { method: "POST", body: JSON.stringify(data) }),
  messages: (conversationId: string) => request<{ messages: any[] }>(`/conversations/${conversationId}/messages`),
  chat: (conversationId: string, text: string) =>
    request<{ reply: string; toolCalls: any[] }>(`/conversations/${conversationId}/chat`, {
      method: "POST",
      body: JSON.stringify({ text }),
    }),
  pendingActions: () => request<{ actions: any[] }>("/actions/pending"),
  allActions: (status?: string) => request<{ actions: any[] }>(`/actions${status ? `?status=${status}` : ""}`),
  approve: (id: string, note?: string) => request(`/actions/${id}/approve`, { method: "POST", body: JSON.stringify({ note }) }),
  reject: (id: string, note?: string) => request(`/actions/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
  auditLog: () => request<{ entries: any[] }>("/audit-log"),
};
