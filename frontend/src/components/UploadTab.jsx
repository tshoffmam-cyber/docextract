import { useRef, useState, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { jobs } from "../api/client";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const LS_KEY = "docextract_form";
const MAX_FILE_BYTES = 500 * 1024 * 1024; // 500 MB

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
    onProgress(Math.round((i / pdf.numPages) * 60)); // 0-60%
  }
  return pageTexts.join("\n\n--- Página seguinte ---\n\n");
}

export default function UploadTab({ onJobStarted }) {
  const fileRef = useRef();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [medicao, setMedicao] = useState("");
  const [periodo, setPeriodo] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(""); // "extracting" | "sending" | ""
  const [progress, setProgress] = useState(0);
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
    setProgress(0);

    try {
      // Phase 1: extract text in browser
      setPhase("extracting");
      const text = await extractTextFromPDF(file, setProgress);

      // Phase 2: send to backend
      setPhase("sending");
      setProgress(70);

      const { data } = await jobs.extractText({
        text,
        prompt: prompt.trim() || "Extraia os dados do documento.",
        empresa,
        medicao,
        periodo,
      });

      setProgress(100);
      onJobStarted(data.job_id);
    } catch (err) {
      setError(err.response?.data?.detail ?? err.message ?? "Erro ao processar arquivo.");
    } finally {
      setLoading(false);
      setPhase("");
      setProgress(0);
    }
  };

  const phaseLabel = {
    extracting: file && file.size > 20 * 1024 * 1024
      ? "Extraindo texto do PDF grande, aguarde..."
      : "Extraindo texto do PDF...",
    sending: "Enviando para análise com IA...",
  };

  return (
    <form onSubmit={submit} className="p-6 space-y-5">
      {/* Drop zone */}
      <div
        onClick={() => !loading && fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files[0])}
        />
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {file ? (
            <div>
              <p className="font-medium text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400">{formatSize(file.size)}</p>
            </div>
          ) : (
            <div>
              <p className="font-medium">Clique ou arraste um PDF aqui</p>
              <p className="text-xs text-gray-400">Apenas .pdf — até 500 MB</p>
            </div>
          )}
        </div>
      </div>

      {/* Context fields */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Empresa / Contratada</label>
          <input className="input" placeholder="Ex: CESAN" value={empresa}
            onChange={(e) => setEmpresa(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Medição</label>
          <input className="input" placeholder="Ex: 12ª Medição" value={medicao}
            onChange={(e) => setMedicao(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Período</label>
          <input className="input" placeholder="Ex: Janeiro/2025" value={periodo}
            onChange={(e) => setPeriodo(e.target.value)} />
        </div>
      </div>

      {/* Instruction */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Instrução de extração</label>
        <textarea
          className="input font-mono text-sm"
          rows={3}
          placeholder="Descreva o que extrair do PDF..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
      </div>

      {/* Loading progress */}
      {loading && phase && (
        <div className="space-y-1">
          <p className="text-sm text-blue-600">{phaseLabel[phase]}</p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

      <button className="btn-primary w-full" type="submit" disabled={loading}>
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Processando...
          </span>
        ) : "Enviar PDF"}
      </button>
    </form>
  );
}
