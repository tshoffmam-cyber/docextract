# DocExtract — Base44 Import

## 1. RESUMO DO PROJETO

DocExtract é um sistema de auditoria inteligente de contratos públicos trabalhistas (CESAN/ES).
Recebe PDFs de holerites, FGTS, VT, ponto e ASOs, extrai dados com Google Gemini 1.5 Flash e gera relatórios no formato FATO.
Stack: FastAPI + Celery + PostgreSQL + Redis + Cloudflare R2 no backend; React + Vite + Tailwind no frontend.
Deploy no Railway falhou por conflito da variável PORT (valor manual sobrescrevia a injeção automática do Railway).
Migração para Base44 para eliminar complexidade de infra e focar na lógica de negócio.

---

## 2. App.jsx COMPLETO

```jsx
import { useEffect, useRef, useState } from "react";
import { auth, jobs } from "./api/client";
import { useJobPolling } from "./hooks/useJobPolling";

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
    <div className="p-4 space-y-2">
      <p className="text-sm text-gray-600">{message}</p>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div className="bg-blue-600 h-3 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }} />
      </div>
      <p className="text-xs text-gray-400 text-right">{progress}%</p>
    </div>
  );
}

function UploadTab({ onJobStarted }) {
  const fileRef = useRef();
  const [fields, setFields] = useState(
    JSON.stringify({ Holerite:"", FGTS:"", "Vale Transporte":"", "Ponto/Frequência":"", ASO:"" }, null, 2)
  );
  const [contrato, setContrato] = useState(
    JSON.stringify({ name:"Contrato CESAN", client:"CESAN", edital:"PE 001/2024" }, null, 2)
  );
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
      <label className="block text-xs text-gray-500 mb-1">Campos a auditar (JSON)</label>
      <textarea className="input font-mono text-xs" rows={5} value={fields}
        onChange={(e) => setFields(e.target.value)} />
      <label className="block text-xs text-gray-500 mb-1">Dados do contrato (JSON)</label>
      <textarea className="input font-mono text-xs" rows={4} value={contrato}
        onChange={(e) => setContrato(e.target.value)} />
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <button className="btn-primary" type="submit">Enviar PDF para auditoria</button>
    </form>
  );
}

function ResultsTab({ result }) {
  if (!result) return <p className="p-4 text-gray-500">Nenhum resultado ainda.</p>;
  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-3 gap-2 text-sm bg-gray-50 p-3 rounded">
        <div><span className="font-semibold">Tipo:</span> {result.tipo_documento}</div>
        <div><span className="font-semibold">Empresa:</span> {result.empresa}</div>
        <div><span className="font-semibold">Competência:</span> {result.competencia}</div>
      </div>
      <p className="text-sm font-semibold">
        {result.total_funcionarios} funcionário(s) analisado(s) —{" "}
        <span className={result.inconsistencias?.length > 0 ? "text-red-600" : "text-green-600"}>
          {result.inconsistencias?.length ?? 0} inconsistência(s)
        </span>
      </p>
      {result.inconsistencias?.length > 0 && (
        <ul className="text-sm space-y-1">
          {result.inconsistencias.map((inc, i) => (
            <li key={i} className="bg-red-50 border border-red-100 rounded p-2">
              <span className="font-medium">{inc.funcionario}</span> — {inc.campo}: {inc.descricao}
            </li>
          ))}
        </ul>
      )}
      {result.funcionarios?.length > 0 && (
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1 text-left">Funcionário</th>
              {Object.keys(result.funcionarios[0].campos ?? {}).map((c) => (
                <th key={c} className="border px-2 py-1">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.funcionarios.map((f, i) => (
              <tr key={i} className="odd:bg-white even:bg-gray-50">
                <td className="border px-2 py-1 font-medium">{f.nome}</td>
                {Object.values(f.campos ?? {}).map((v, j) => (
                  <td key={j} className={`border px-2 py-1 text-center text-xs ${
                    v.status === "Inconsistente" ? "text-red-600 font-semibold" :
                    v.status === "Não apresentado" ? "text-orange-500" :
                    v.status === "Não consta" ? "text-gray-400" : "text-green-600"
                  }`}>{v.status}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

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

const TABS = ["Upload", "Resultado", "Relatório"];

export default function App() {
  const [authed, setAuthed] = useState(!!localStorage.getItem("token"));
  const [tab, setTab] = useState(0);
  const [jobId, setJobId] = useState(null);

  const { status, progress, message, result, error } = useJobPolling(jobId);
  const processing = jobId && !["done", "error", null].includes(status);

  useEffect(() => { if (status === "done") setTab(1); }, [status]);

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
              }`}>{t}</button>
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
```

---

## 3. PROMPT PARA BASE44

Cole o texto abaixo diretamente no Base44:

---

Crie um app chamado **DocExtract** — sistema de auditoria inteligente de contratos públicos trabalhistas.

### O que o app faz

1. Usuário faz upload de um PDF (holerite, FGTS, Vale Transporte, ponto, ASO)
2. O app converte cada página em imagem e envia em lotes para o **Google Gemini 1.5 Flash**
3. Gemini extrai, por funcionário, o status de cada campo: `Apresentado`, `Não apresentado`, `Não consta` ou `Inconsistente`
4. O app gera um **Relatório FATO** padronizado com classificação, inconsistências e base legal
5. Usuário baixa o relatório em `.txt`

### Campos padrão CESAN a auditar

```json
{
  "Holerite": "",
  "FGTS": "",
  "Vale Transporte": "",
  "Ponto / Frequência": "",
  "ASO": "",
  "Férias": "",
  "13º Salário": "",
  "Rescisão": ""
}
```

### Prompt que deve ser enviado ao Gemini (por lote de páginas)

```
Você é um auditor especialista em documentação trabalhista brasileira.
Contrato: {name}, Cliente: {client}, Edital: {edital}
Lote {N}/{TOTAL}. Analise as imagens e extraia dados de TODOS os funcionários visíveis.

Campos a extrair por funcionário: {lista_de_campos}

Para cada campo use os status:
- "Apresentado" → documento/valor presente e correto
- "Não apresentado" → deveria existir mas está ausente
- "Não consta" → campo inexistente neste tipo de documento
- "Inconsistente" → divergência ou valor suspeito

Retorne SOMENTE JSON válido:
{
  "tipo_documento": "holerite|fgts|vt|ponto|aso|outro",
  "competencia": "MM/AAAA",
  "empresa": "nome da empresa",
  "total_funcionarios": 0,
  "funcionarios": [
    {
      "nome": "NOME COMPLETO",
      "campos": {
        "campo_nome": {"valor": "...", "status": "Apresentado"}
      }
    }
  ],
  "inconsistencias": [
    {"funcionario": "nome", "campo": "campo", "descricao": "descrição"}
  ],
  "resumo": "texto resumindo o lote"
}
```

### Formato do Relatório FATO (texto final gerado pelo app)

```
================================================================================
RELATÓRIO FATO — DocExtract
================================================================================
Contrato : {name}
Cliente  : {client}
Edital   : {edital}
Documento: {TIPO} — Competência {MM/AAAA}
Empresa  : {empresa}
Data     : {hoje}
--------------------------------------------------------------------------------

1. CLASSIFICAÇÃO
   Eficaz | Melhorias Requeridas

2. EVIDÊNCIAS
   {resumo da análise}

3. INCONSISTÊNCIAS IDENTIFICADAS
   1. [Funcionário] Campo: descrição do problema

4. RESUMO QUANTITATIVO
   Total de funcionários analisados : N
   Conformes                        : N
   Pendentes / Inconsistências      : N
   Índice de conformidade           : XX%

5. BASE LEGAL
   - Edital {edital}, Cláusulas de Obrigações Trabalhistas
   - CLT — Consolidação das Leis do Trabalho
   - Lei 8.036/90 (FGTS)
   - NR-7 (PCMSO / ASO)

6. RISCO / CONSEQUÊNCIA
   Baixo | Médio/Alto — N irregularidade(s) identificada(s).

7. RECOMENDAÇÕES
   Manter o padrão | Regularizar as pendências antes da próxima medição.

--------------------------------------------------------------------------------
Fiscal responsável: ___________________________     Data: {hoje}
Gerado pelo DocExtract — Sistema de Auditoria Inteligente de Contratos Públicos
================================================================================
```

### Regras de negócio

- Processar PDF em lotes de 15 páginas
- Máximo de 50 páginas por PDF
- Desduplicar funcionários pelo nome (case-insensitive); para campos duplicados, preferir status diferente de "Não consta"
- Se Gemini falhar, exibir mensagem de erro clara
- Mostrar barra de progresso durante processamento

### Telas necessárias

1. **Login / Cadastro** — email + senha
2. **Upload** — seletor de PDF + campos JSON editáveis + dados do contrato JSON
3. **Resultado** — tabela funcionário × campo com cores por status + lista de inconsistências
4. **Relatório** — visualização e botão de download do .txt

### Variável de ambiente necessária

```
GEMINI_API_KEY=sua-chave-do-google-ai-studio
```

Obter em: https://aistudio.google.com/app/apikey (gratuito)
