import { useEffect, useState } from "react";
import { auth } from "./api/client";
import { useJobPolling } from "./hooks/useJobPolling";
import UploadTab from "./components/UploadTab";
import ResultsTab from "./components/ResultsTab";
import ReportTab from "./components/ReportTab";
import HistoryTab from "./components/HistoryTab";
import SettingsTab from "./components/SettingsTab";

const NAV = [
  {
    id: 0, label: "Upload",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
  },
  {
    id: 1, label: "Resultados",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  {
    id: 2, label: "Relatorio",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    id: 3, label: "Historico",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  },
  {
    id: 4, label: "Configuracoes",
    icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

// ── Login form ──────────────────────────────────────────────────────────────
function LoginForm({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await auth.login(email, password);
      onLogin();
    } catch {
      setError("Email ou senha invalidos");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!email || !password) { setError("Preencha email e senha"); return; }
    setLoading(true);
    setError("");
    try {
      await auth.register(email, password);
      await auth.login(email, password);
      onLogin();
    } catch (err) {
      setError(err.response?.data?.detail || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gray-900 rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-white">DE</div>
          <h1 className="text-2xl font-bold text-white">DocExtract</h1>
          <p className="text-gray-400 text-sm mt-1">Auditoria de Contratos Trabalhistas</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="E-mail" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500" placeholder="Senha" />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500">
          Nao tem conta?{" "}
          <button onClick={handleRegister} className="text-blue-400 hover:underline">Criar agora</button>
        </p>
      </div>
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState(0);
  const [job, setJob] = useState(null);

  useEffect(() => {
    auth.me().then(setUser).catch(() => setUser(null)).finally(() => setChecking(false));
  }, []);

  useJobPolling(job, (updated) => setJob(updated));

  if (checking) return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Carregando...</div>;
  if (!user) return <LoginForm onLogin={() => auth.me().then(setUser)} />;

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold text-white">DE</div>
          <span className="text-white font-semibold">DocExtract</span>
        </div>
        <button onClick={() => { auth.logout(); setUser(null); }}
          className="text-sm text-gray-400 hover:text-white transition">Sair</button>
      </header>

      {/* Nav */}
      <nav className="bg-gray-900 border-b border-gray-800 px-4 flex gap-1 overflow-x-auto">
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)}
            className={"flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 whitespace-nowrap " +
              (tab === n.id ? "border-blue-500 text-blue-400" : "border-transparent text-gray-400 hover:text-gray-200")}>
            {n.icon}{n.label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        {tab === 0 && <UploadTab onJobCreated={(j) => { setJob(j); setTab(1); }} />}
        {tab === 1 && <ResultsTab job={job} onViewReport={() => setTab(2)} />}
        {tab === 2 && <ReportTab job={job} />}
        {tab === 3 && <HistoryTab onSelectJob={(j) => { setJob(j); setTab(1); }} />}
        {tab === 4 && <SettingsTab />}
      </main>
    </div>
  );
}
