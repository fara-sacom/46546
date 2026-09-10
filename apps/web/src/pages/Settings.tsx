import { useEffect, useState } from "react";
import { api } from "../api";
import { RESPONSE_STYLE_LABEL } from "../labels";

const STYLES = ["AUTO", "SAUDI", "FUSHA", "ENGLISH"];

export default function Settings() {
  const [settings, setSettings] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSettings().then((r) => setSettings(r.settings)).catch((e) => setError(e.message));
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { settings: updated } = await api.updateSettings({
        responseStyle: settings.responseStyle,
        shippingPolicy: settings.shippingPolicy ?? "",
        paymentPolicy: settings.paymentPolicy ?? "",
        exchangePolicy: settings.exchangePolicy ?? "",
      });
      setSettings(updated);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) return <p className="muted">جارٍ التحميل...</p>;

  return (
    <div>
      <h2>الإعدادات</h2>
      {error && <div className="panel" style={{ borderColor: "var(--danger)" }}>{error}</div>}

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>أسلوب الرد</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          يتحكم بلهجة/لغة كل ردود المساعدين - يمكنك تثبيت أسلوب واحد دائمًا، أو تركه تلقائيًا فيتكيّف كل مساعد مع لغة الطرف الآخر (سعودي راقٍ للعميلات العربيات، إنجليزي للعملاء الدوليين).
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STYLES.map((s) => (
            <button
              key={s}
              className={`btn ${settings.responseStyle === s ? "primary" : ""}`}
              onClick={() => setSettings({ ...settings, responseStyle: s })}
            >
              {RESPONSE_STYLE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h3 style={{ marginTop: 0 }}>سياسات المتجر (يعتمد عليها مساعدو واتساب وإنستغرام وتيك توك)</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          اكتبيها بنفسك بدقة - المساعدون يستخدمونها كما هي حرفيًا ولا يخترعون سياسة بديلة إن تُركت فارغة.
        </p>
        <label style={{ display: "block", marginBottom: 12 }}>
          سياسة الشحن
          <textarea
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", minHeight: 70 }}
            value={settings.shippingPolicy ?? ""}
            onChange={(e) => setSettings({ ...settings, shippingPolicy: e.target.value })}
          />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          سياسة الدفع
          <textarea
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", minHeight: 70 }}
            value={settings.paymentPolicy ?? ""}
            onChange={(e) => setSettings({ ...settings, paymentPolicy: e.target.value })}
          />
        </label>
        <label style={{ display: "block" }}>
          سياسة الاستبدال والاسترجاع
          <textarea
            style={{ width: "100%", marginTop: 4, padding: 8, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", color: "var(--text)", fontFamily: "inherit", minHeight: 70 }}
            value={settings.exchangePolicy ?? ""}
            onChange={(e) => setSettings({ ...settings, exchangePolicy: e.target.value })}
          />
        </label>
      </div>

      <button className="btn primary" onClick={save} disabled={saving}>
        {saving ? "جارٍ الحفظ…" : "حفظ الإعدادات"}
      </button>
      {saved && <span className="muted" style={{ marginInlineStart: 10 }}>تم الحفظ ✓</span>}
    </div>
  );
}
