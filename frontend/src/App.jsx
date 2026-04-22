import { useEffect, useRef, useState } from "react";
import { auth, jobs } from "./api/client";
import { useJobPolling } from "./hooks/useJobPolling";

/* ── Auth Screen ──────────────────────────────────────────── */
function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [error, setError] = useState("");

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const fn = mode === "login" ? auth.login : auth.register;
      const { data } = await fn(form);
      localStorage.setItem("token", data.access_token);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.detail ?? "Erro ao autenticar.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">DocExtract</h1>
        <form onSubmit={handle} className="space-y-4">
          {mode === "register" && (
            <input className="input" placeholder="Nome" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          )}
          <input className="input" type="email" placeholder="E-mail" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="input" type="password" placeholder="Senha" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} required />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button className="btn-primary w-full" type="submit">
            {mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <button className="mt-4 text-sm text-blue-600 w-full text-center"
          onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "Criar conta" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}

/* ── Upload Tab ───────────────────────────────────────────── */
function UploadTab({ onJobStarted }) {
  const fileRef = useRef();
  const [fields, setFields] = useState("{}");
  const [contrato, setContrato] = useState("{}");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const file = fileRef.current?.files[0];
    if (!file) return setError("Selecione um PDF.");

    const fd = new FormData();
    fd.append("file", file);
    fd.append("fields", fields);
    fd.append("contrato", contrato);

    try {
      const { data } = await jobs.upload(fd);
      onJobStarted(data.job_id);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Erro ao enviar arquivo.");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4 p-4">
      <input ref={fileRef} type="file" accept="application/pdf" className="block w-full" />
      <textarea className="input font-mono text-xs" rows={3} placeholder='campos JSON ex: {"Holerite":"","FGTS":""}' value={fields}
        onChange={(e) => setFields(e.target.value)} />
      <textarea className="input font-mono text-xs" rows={3} placeholder='contrato JSON ex: {"name":"Contrato X","client":"CESAN","edital":"001/2024"}' value={contrato}
        onChange={(e) => setContrato(e.target.value)} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button className="btn-primary" type="submit">Enviar PDF</button>
    </form>
  );
}

/* ── Progress Bar ─────────────────────────────────────────── */
function ProgressBar({ progress, message }) {
  return (
    <div className="p-4 space-y-2">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-gray-400 text-right">{progress}%</p>
    </div>
  );
}

/* ── Results Tab ──────────────────────────────────────────── */
function ResultsTab({ result }) {
  if (!result) return <p className="p-4 text-gray-500">Nenhum resultado ainda.</p>;

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><span className="font-semibold">Tipo:</span> {result.tipo_documento}</div>
        <div><span className="font-semibold">Empresa:</span> {result.empresa}</div>
        <div><span className="font-semibold">Competência:</span> {result.competencia}</div>
      </div>
      <p className="text-sm"><span className="font-semibold">Funcionários:</span> {result.total_funcionarios}</p>

      {result.inconsistencias?.length > 0 && (
        <div>
          <h3 className="font-semibold text-red-600 mb-1">Inconsistências ({result.inconsistencias.length})</h3>
          <ul className="text-sm space-y-1">
            {result.inconsistencias.map((inc, i) => (
              <li key={i} className="bg-red-50 rounded p-2">
                <span className="font-medium">{inc.funcionario}</span> — {inc.campo}: {inc.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}

      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="border px-2 py-1 text-left">Funcionário</th>
            {result.funcionarios[0] && Object.keys(result.funcionarios[0].campos ?? {}).map((c) => (
              <th key={c} className="border px-2 py-1">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.funcionarios.map((f, i) => (
            <tr key={i} className="odd:bg-white even:bg-gray-50">
              <td className="border px-2 py-1 font-medium">{f.nome}</td>
              {Object.values(f.campos ?? {}).map((v, j) => (
                <td key={j} className={`border px-2 py-1 text-center ${v.status === "Inconsistente" ? "text-red-600" : v.status === "Não apresentado" ? "text-orange-500" : "text-green-600"}`}>
                  {v.status}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Report Tab ───────────────────────────────────────────── */
function ReportTab({ result }) {
  if (!result?.report_text) return <p className="p-4 text-gray-500">Relatório não disponível.</p>;

  const download = () => {
    const blob = new Blob([result.report_text], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-fato-${result.competencia ?? "sem-data"}.txt`;
    a.click();
  };

  return (
    <div className="p-4 space-y-3">
      <button className="btn-primary text-sm" onClick={download}>Baixar relatório .txt</button>
      <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded overflow-auto max-h-[60vh] whitespace-pre-wrap">
        {result.report_text}
      </pre>
    </div>
  );
}

/* ── Main App ─────────────────────────────────────────────── */
const TABS = ["Upload", "Resultado", "Relatório"];

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [tab, setTab] = useState(0);
  const [jobId, setJobId] = useState(null);

  const { status, progress, message, result, error } = useJobPolling(jobId);

  const processing = jobId && !["done", "error", null].includes(status);

  useEffect(() => {
    if (status === "done") setTab(1);
  }, [status]);

  if (!authed) return <AuthScreen onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold">DocExtract</h1>
        <button className="text-sm text-gray-500 hover:text-red-500"
          onClick={() => { localStorage.removeItem("token"); setAuthed(false); }}>
          Sair
        </button>
      </header>

      <div className="max-w-5xl mx-auto mt-6 bg-white rounded-xl shadow">
        <nav className="flex border-b">
          {TABS.map((t, i) => (
            <button key={t} onClick={() => setTab(i)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </nav>

        {processing && <ProgressBar progress={progress} message={message} />}
        {error && <p className="p-4 text-red-500 text-sm">{error}</p>}

        {tab === 0 && <UploadTab onJobStarted={(id) => { setJobId(id); setTab(0); }} />}
        {tab === 1 && <ResultsTab result={result} />}
        {tab === 2 && <ReportTab result={result} />}
      </div>
    </div>
  );
}
