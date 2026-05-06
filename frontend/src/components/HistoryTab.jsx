import { useState, useEffect } from "react";
import { jobs } from "../api/client";

export default function HistoryTab({ onSelectJob }) {
    const [list, setList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

  useEffect(() => {
                jobs.list()
          .then((r) => setList(r.data || []))
          .catch(() => setError("Falha ao carregar historico."))
          .finally(() => setLoading(false));
  }, []);

  const statusLabel = (s) => ({
        queued: "Na fila",
        processing: "Processando",
        done: "Concluido",
        error: "Erro",
  }[s] || s);

  const statusColor = (s) => ({
        queued: "text-yellow-400",
        processing: "text-blue-400",
        done: "text-green-400",
        error: "text-red-400",
  }[s] || "text-gray-400");

  if (loading) return (
        <div className="flex-1 flex items-center justify-center">
              <p className="text-gray-400">Carregando historico...</p>p>
        </div>div>
      );
  
    if (error) return (
          <div className="flex-1 flex items-center justify-center">
                <p className="text-red-400">{error}</p>p>
          </div>div>
        );
  
    if (list.length === 0) return (
          <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500">Nenhuma analise encontrada.</p>p>
          </div>div>
        );
  
    return (
          <div className="flex-1 overflow-auto p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Historico de Analises</h2>h2>
                <div className="space-y-2">
                  {list.map((job) => (
                      <div
                                    key={job.id}
                                    className="bg-gray-900 border border-gray-700/50 rounded-lg p-4 flex items-center justify-between hover:border-blue-600/40 transition-colors"
                                  >
                                  <div>
                                                <p className="text-sm font-medium text-white">
                                                  {job.contrato?.empresa || job.original_filename || "Documento"}
                                                </p>p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                  {job.contrato?.periodo && `Periodo: ${job.contrato.periodo} · `}
                                                  {new Date(job.created_at).toLocaleString("pt-BR")}
                                                </p>p>
                                  </div>div>
                                  <div className="flex items-center gap-3">
                                                <span className={`text-xs font-medium ${statusColor(job.status)}`}>
                                                  {statusLabel(job.status)}
                                                </span>span>
                                    {job.status === "done" && (
                                                    <button
                                                                        onClick={() => onSelectJob && onSelectJob(job)}
                                                                        className="text-xs btn-primary px-3 py-1"
                                                                      >
                                                                      Ver Resultado
                                                    </button>button>
                                                )}
                                  </div>div>
                      </div>div>
                    ))}
                </div>div>
          </div>div>
        );
}</div>
