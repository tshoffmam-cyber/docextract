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
            <p className="text-gray-400">Carregando historico...</p>
        </div>
    );

    if (error) return (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-red-400">{error}</p>
        </div>
    );

    if (list.length === 0) return (
        <div className="flex-1 flex items-center justify-center">
            <p className="text-gray-400">Nenhum documento processado ainda.</p>
        </div>
    );

    return (
        <div className="flex-1 overflow-y-auto p-4">
            <h2 className="text-lg font-semibold text-white mb-4">Historico</h2>
            <div className="space-y-2">
                {list.map((job) => (
                    <div key={job.id} className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
                        <div>
                            <p className="text-white font-medium text-sm">{job.filename}</p>
                            <p className="text-xs text-gray-400 mt-1">
                                {new Date(job.created_at).toLocaleString("pt-BR")}
                            </p>
                            <span className={statusColor(job.status) + " text-xs font-medium"}>
                                {statusLabel(job.status)}
                            </span>
                        </div>
                        <button onClick={() => onSelectJob(job)} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition-colors">
                            Ver Resultado
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
