import { useEffect, useState } from "react";
import { auth } from "./api/client";
import { useJobPolling } from "./hooks/useJobPolling";
import UploadTab from "./components/UploadTab";
import ResultsTab from "./components/ResultsTab";
import ReportTab from "./components/ReportTab";

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

function ProgressBar({ progress, message }) {
  return (
    <div className="p-4 space-y-2 border-b">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-600 h-3 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-gray-400 text-right">{progress}%</p>
    </div>
  );
}

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
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === i ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}>
              {t}
            </button>
          ))}
        </nav>

        {processing && <ProgressBar progress={progress} message={message} />}
        {error && <p className="p-4 text-red-500 text-sm font-medium">{error}</p>}

        {tab === 0 && <UploadTab onJobStarted={(id) => { setJobId(id); }} />}
        {tab === 1 && <ResultsTab result={result} />}
        {tab === 2 && <ReportTab result={result} />}
      </div>
    </div>
  );
}
