import { useState, useEffect } from "react";
import api from "../api/client";

const FIELDS = [
  {
    key: "gemini_api_key",
    label: "Gemini API Key",
    hint: "Google AI Studio — gratuito. Obtenha em aistudio.google.com",
    placeholder: "AIza...",
    free: true,
  },
  {
    key: "anthropic_api_key",
    label: "Anthropic API Key (Claude)",
    hint: "Pago (pay-as-you-go). Obtenha em console.anthropic.com",
    placeholder: "sk-ant-api03-...",
    free: false,
  },
  {
    key: "r2_account_id",
    label: "Cloudflare R2 — Account ID",
    hint: "Opcional. Sem isso, PDFs ficam salvos no disco do servidor.",
    placeholder: "abc123...",
    free: false,
    group: "r2",
  },
  {
    key: "r2_access_key_id",
    label: "Cloudflare R2 — Access Key ID",
    placeholder: "...",
    free: false,
    group: "r2",
  },
  {
    key: "r2_secret_access_key",
    label: "Cloudflare R2 — Secret Access Key",
    placeholder: "...",
    free: false,
    group: "r2",
    secret: true,
  },
  {
    key: "r2_bucket_name",
    label: "Cloudflare R2 — Bucket Name",
    placeholder: "docextract-pdfs",
    free: false,
    group: "r2",
  },
  {
    key: "r2_public_url",
    label: "Cloudflare R2 — URL Pública",
    placeholder: "https://pub-xxx.r2.dev",
    free: false,
    group: "r2",
  },
];

export default function SettingsTab() {
  const [current, setCurrent] = useState({});
  const [form, setForm] = useState({});
  const [storageMode, setStorageMode] = useState("local");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    api
      .get("/settings")
      .then((r) => {
        setCurrent(r.data);
        setStorageMode(r.data.storage_mode);
      })
      .catch(() => setMsg({ type: "error", text: "Erro ao carregar configuracoes." }))
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (key, val) => {
    setForm((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    const payload = {};
    Object.entries(form).forEach(([k, v]) => {
      if (v && v.trim() && !v.includes("****")) payload[k] = v.trim();
    });
    if (!Object.keys(payload).length) {
      setMsg({ type: "error", text: "Nenhuma chave foi alterada." });
      return;
    }
    setSaving(true);
    try {
      const res = await api.put("/settings", payload);
      setMsg({ type: "ok", text: "Salvo com sucesso: " + res.data.updated.join(", ") });
      setForm({});
      const r = await api.get("/settings");
      setCurrent(r.data);
      setStorageMode(r.data.storage_mode);
    } catch (e) {
      setMsg({ type: "error", text: "Erro ao salvar: " + (e.response?.data?.detail || e.message) });
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return <div className="p-8 text-center text-gray-400">Carregando...</div>;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Configuracoes</h2>
        <p className="text-sm text-gray-400">
          Gerencie as chaves de API e armazenamento sem precisar acessar o servidor.
        </p>
      </div>

      {/* Storage mode badge */}
      <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-4 py-3">
        <span className="text-sm text-gray-300">Armazenamento atual:</span>
        <span
          className={
            "px-2 py-0.5 rounded text-xs font-semibold " +
            (storageMode === "r2"
              ? "bg-blue-600 text-white"
              : "bg-green-700 text-white")
          }
        >
          {storageMode === "r2" ? "Cloudflare R2" : "Disco local (VPS)"}
        </span>
        {storageMode === "local" && (
          <span className="text-xs text-gray-500">
            — Configure as chaves R2 abaixo para migrar para a nuvem
          </span>
        )}
      </div>

      {msg && (
        <div
          className={
            "px-4 py-3 rounded text-sm " +
            (msg.type === "ok"
              ? "bg-green-800 text-green-200"
              : "bg-red-800 text-red-200")
          }
        >
          {msg.text}
        </div>
      )}

      <div className="space-y-5">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-200">
                {f.label}
              </label>
              <span
                className={
                  "text-xs px-1.5 py-0.5 rounded " +
                  (f.free
                    ? "bg-green-800 text-green-300"
                    : "bg-yellow-800 text-yellow-300")
                }
              >
                {f.free ? "Gratuito" : "Pago / Opcional"}
              </span>
            </div>
            {f.hint && (
              <p className="text-xs text-gray-500">{f.hint}</p>
            )}
            <div className="flex gap-2">
              <input
                type={f.secret ? "password" : "text"}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500"
                placeholder={
                  current[f.key]
                    ? "Atual: " + current[f.key] + " (deixe em branco para manter)"
                    : f.placeholder
                }
                value={form[f.key] || ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white font-semibold py-2.5 rounded-lg transition"
      >
        {saving ? "Salvando..." : "Salvar Configuracoes"}
      </button>
    </div>
  );
}
