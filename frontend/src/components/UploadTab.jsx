import { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jobs } from "../api/client";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const LS_KEY = "docextract_form";
const MAX_FILE_BYTES = 500 * 1024 * 1024;

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function extractTextFromPDF(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
    onProgress(Math.round((i / pdf.numPages) * 60));
  }
  return pageTexts.join("\n\n--- Página seguinte ---\n\n");
}

function RightPanel({ loading, phase, localProgress, polling, file }) {
  if (loading) {
    const label =
      phase === "extracting"
        ? file?.size > 20 * 1024 * 1024
          ? "Extraindo texto do PDF grande..."
          : "Extraindo texto do PDF..."
        : "Enviando para análise com IA...";
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-10">
        <div className="w-16 h-16 bg-blue-600/10 border border-blue-600/20 rounded-full flex items-center justify-center">
          <svg className="animate-spin w-7 h-7 text-blue-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">{label}</p>
          <p className="text-gray-500 text-sm mt-1">Aguarde, isso pode demorar para PDFs grandes</p>
        </div>
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{phase === "extracting" ? "Extração local" : "Upload"}</span>
            <span>{localProgress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${localProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  if (polling?.isProcessing) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 px-10">
        <div className="w-16 h-16 bg-violet-600/10 border border-violet-600/20 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">IA analisando o documento</p>
          <p className="text-gray-500 text-sm mt-1">{polling.message || "Processando..."}</p>
        </div>
        <div className="w-full max-w-xs space-y-1.5">
          <div className="flex justify-between text-xs text-gray-500">
            <span>Progresso</span>
            <span>{polling.progress}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-1.5">
            <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${polling.progress}%` }} />
          </div>
        </div>
        <p className="text-xs text-gray-600">Os resultados aparecerão automaticamente na aba Resultado</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-center h-full px-10 py-8">
      <h3 className="text-white font-semibold text-base mb-6">Como funciona</h3>
      <div className="space-y-5">
        {[
          { n: "01", color: "bg-blue-600/15 text-blue-400 border-blue-600/20", title: "Faça upload do PDF", desc: "Arraste ou selecione qualquer PDF até 500 MB" },
          { n: "02", color: "bg-purple-600/15 text-purple-400 border-purple-600/20", title: "Configure o contexto", desc: "Informe empresa, medição, período e instrução" },
          { n: "03", color: "bg-emerald-600/15 text-emerald-400 border-emerald-600/20", title: "IA extrai os dados", desc: "Gemini 1.5 Flash analisa automaticamente" },
          { n: "04", color: "bg-orange-600/15 text-orange-400 border-orange-600/20", title: "Visualize os resultados", desc: "Tabela, inconsistências e relatório FATO" },
        ].map(({ n, color, title, desc }) => (
          <div key={n} className="flex items-start gap-4">
            <div className={`w-8 h-8 ${color} border rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0`}>{n}</div>
            <div>
              <p className="text-sm font-medium text-gray-200">{title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-5 border-t border-gray-700/50">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
          <span className="text-xs text-gray-600">Backend conectado</span>
        </div>
        <p className="text-xs text-gray-700">Powered by Gemini 1.5 Flash + Anthropic Claude</p>
      </div>
    </div>
  );
}

export default function UploadTab({ onJobStarted, polling }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [medicao, setMedicao] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [localProgress, setLocalProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
      if (saved.prompt) setPrompt(saved.prompt);
      if (saved.empresa) setEmpresa(saved.empresa);
      if (saved.medicao) setMedicao(saved.medicao);
      if (saved.periodo) setPeriodo(saved.periodo);
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ prompt, empresa, medicao, periodo }));
  }, [prompt, empresa, medicao, periodo]);

  const handleFile = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.endsWith(".pdf")) {
      setError("Apenas arquivos PDF são aceitos.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError(`Arquivo muito grande (${formatSize(f.size)}). Máximo: 500 MB.`);
      return;
    }
    setFile(f);
    setError("");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!file) return setError("Selecione um PDF.");
    setLoading(true);
    setLocalProgress(0);
    try {
      setPhase("extracting");
      const text = await extractTextFromPDF(file, setLocalProgress);
      setPhase("sending");
      setLocalProgress(70);
      const { data } = await jobs.extractText({
        text,
        prompt: prompt.trim() || "Extraia os dados do documento.",
        empresa, medicao, periodo,
      });
      setLocalProgress(100);
      onJobStarted(data.job_id);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? "Erro ao processar arquivo.");
    } finally {
      setLoading(false);
      setPhase("");
      setLocalProgress(0);
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left — form (40%) */}
      <div className="w-[42%] flex-shrink-0 border-r border-gray-700/50 flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-700/50 flex-shrink-0">
          <h2 className="text-sm font-semibold text-white">Nova Análise</h2>
          <p className="text-xs text-gray-600 mt-0.5">Faça upload de um PDF para extrair dados com IA</p>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Drop zone */}
          <div
            onClick={() => !loading && fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
              dragging
                ? "border-blue-500 bg-blue-500/5"
                : file
                  ? "border-emerald-600/50 bg-emerald-900/10"
                  : "border-gray-700 hover:border-gray-600 hover:bg-gray-800/30"
            }`}
          >
            <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
              onChange={(e) => handleFile(e.target.files[0])} />
            <div className="flex flex-col items-center gap-2">
              {file ? (
                <>
                  <div className="w-9 h-9 bg-emerald-600/15 border border-emerald-600/20 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-emerald-400 truncate max-w-full px-2">{file.name}</p>
                  <p className="text-xs text-gray-600">{formatSize(file.size)}</p>
                </>
              ) : (
                <>
                  <div className="w-9 h-9 bg-gray-700/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">Clique ou arraste um PDF</p>
                  <p className="text-xs text-gray-700">Até 500 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Context */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Contexto</p>
            <input className="input text-sm" placeholder="Empresa / Contratada" value={empresa}
              onChange={(e) => setEmpresa(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm" placeholder="Ex: 12ª Medição" value={medicao}
                onChange={(e) => setMedicao(e.target.value)} />
              <input className="input text-sm" placeholder="Ex: Jan/2025" value={periodo}
                onChange={(e) => setPeriodo(e.target.value)} />
            </div>
          </div>

          {/* Instruction */}
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Instrução</p>
            <textarea
              className="input text-xs font-mono resize-none"
              rows={3}
              placeholder="Descreva o que extrair do PDF..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800/50 rounded-lg px-3 py-2">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button
            className="btn-primary w-full py-2.5"
            type="submit"
            disabled={loading || polling?.isProcessing}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Processando...
              </span>
            ) : polling?.isProcessing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Aguardando IA...
              </span>
            ) : "Analisar PDF"}
          </button>
        </form>
      </div>

      {/* Right — status / instructions (60%) */}
      <div className="flex-1 overflow-hidden bg-gray-900/20">
        <RightPanel loading={loading} phase={phase} localProgress={localProgress} polling={polling} file={file} />
      </div>
    </div>
  );
}
