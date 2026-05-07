import { useEffect, useState } from "react";
import { auth } from "./api/client";
import { useJobPolling } from "./hooks/useJobPolling";
import UploadTab from "./components/UploadTab";
import ResultsTab from "./components/ResultsTab";
import ReportTab from "./components/ReportTab";
import HistoryTab from "./components/HistoryTab";

const NAV = [
  {
    id: 0, label: "Upload",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>,
  },
  {
    id: 1, label: "Resultado",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>,
  },
  {
    id: 2, label: "Relatório",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    id: 3, label: "Histórico",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
];

function AuthScreen({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", name: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = mode === "login" ? auth.login : auth.register;
      const { data } = await fn(form);
      localStorage.setItem("token", data.access_token);
      localStorage.setItem("user_email", form.email);
      onLogin(form.email);
    } catch (err) {
      setError(err.response?.data?.detail ?? "Erro ao autenticar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-2xl mb-4 shadow-lg shadow-blue-500/30">
            DE
          </div>
          <h1 className="text-2xl font-bold text-white">DocExtract</h1>
          <p className="text-sm text-gray-500 mt-1">Auditoria de Contratos Trabalhistas</p>
        </div>

        <div className="bg-gray-900 rounded-2xl border border-gray-700/50 p-6 shadow-2xl">
          <h2 className="text-base font-semibold text-white mb-5">
            {mode === "login" ? "Entrar na conta" : "Criar conta"}
          </h2>
          <form onSubmit={handle} className="space-y-3">
            {mode === "register" && (
              <input className="input" placeholder="Nome completo" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            )}
            <input className="input" type="email" placeholder="E-mail" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input className="input" type="password" placeholder="Senha" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            {error && (
              <div className="bg-red-900/30 border border-red-800/50 rounded-lg px-3 py-2">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
            <button className="btn-primary w-full py-2.5 mt-1" type="submit" disabled={loading}>
              {loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}
            </button>
          </form>
          <button
            className="mt-4 text-sm text-blue-400 hover:text-blue-300 w-full text-center transition-colors"
            onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          >
            {mode === "login" ? "Não tem conta? Criar agora" : "Já tenho conta"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [userEmail, setUserEmail] = useState(localStorage.getItem("user_email") || "");
  const [tab, setTab] = useState(0);
  const [jobId, setJobId] = useState(null);

  const { status, progress, message, result, error } = useJobPolling(jobId);
  const isProcessing = !!jobId && !["done", "error", null].includes(status);

  useEffect(() => {
    if (status === "done") setTab(1);
  }, [status]);

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user_email");
    setAuthed(false);
    setUserEmail("");
    setJobId(null);
  };

  if (!authed) {
    return <AuthScreen onLogin={(email) => { setUserEmail(email); setAuthed(true); }} />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="h-14 flex-shrink-0 flex items-center px-5 bg-gray-900 border-b border-gray-700/50 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm shadow-md shadow-blue-500/25 flex-shrink-0">
            DE
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">DocExtract</p>
            <p className="text-[11px] text-gray-500 leading-none mt-0.5">Auditoria de Contratos Trabalhistas</p>
          </div>
        </div>

        {isProcessing && (
          <div className="ml-6 flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-600/20 rounded-lg">
            <svg className="animate-spin h-3.5 w-3.5 text-blue-400 flex-shrink-0" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span className="text-xs text-blue-300">{message || "Processando..."}</span>
            <span className="text-xs text-blue-400 font-semibold">{progress}%</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-3">
          {userEmail && <span className="text-xs text-gray-600 hidden sm:block">{userEmail}</span>}
          <button onClick={logout} className="text-xs text-gray-500 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-900/20">
            Sair
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-[68px] flex-shrink-0 bg-gray-900 border-r border-gray-700/50 flex flex-col py-3 gap-1">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => !item.disabled && setTab(item.id)}
              disabled={item.disabled}
              title={item.label}
              className={[
                "flex flex-col items-center gap-1 py-2.5 mx-2 rounded-lg transition-all text-[10px] font-medium border",
                tab === item.id
                  ? "bg-blue-600/20 text-blue-400 border-blue-600/30"
                  : item.disabled
                    ? "text-gray-800 cursor-not-allowed border-transparent"
                    : "text-gray-600 hover:text-gray-300 hover:bg-gray-800 border-transparent"
              ].join(" ")}
          >
                  {item.icon}
                              {item.label}
                                        </button>
        </aside>

        {/* Main */}
        <main className="flex-1 min-h-0 flex flex-col overflow-hidden bg-gray-950">
          {error && (
            <div className="mx-5 mt-4 flex-shrink-0 bg-red-900/30 border border-red-800/50 rounded-xl px-4 py-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            {tab === 0 && (
              <UploadTab
                onJobStarted={setJobId}
                polling={{ status, progress, message, isProcessing }}
              />
            )}
            {tab === 1 && <ResultsTab result={result} onViewReport={() => setTab(2)} />}
            {tab === 2 && <ReportTab result={result} />}
            {tab === 3 && <HistoryTab onSelectJob={(job) => { setJobId(job.id); setTab(1); }} />}
          </div>
        </main>
      </div>
    </div>
  );
}
