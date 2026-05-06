export default function ResultsTab({ result, onViewReport }) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 border border-gray-700/50">
          <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">Nenhum resultado disponível</p>
        <p className="text-sm text-gray-700 mt-1">Faça o upload de um PDF na aba Upload para começar.</p>
      </div>
    );
  }

  const hasFuncionarios = Array.isArray(result.funcionarios) && result.funcionarios.length > 0;
  const fieldKeys = hasFuncionarios ? Object.keys(result.funcionarios[0]?.campos ?? {}) : [];

  const exportCSV = () => {
    if (!hasFuncionarios) return;
    const header = ["Funcionário", ...fieldKeys];
    const rows = result.funcionarios.map((f) => [
      f.nome,
      ...fieldKeys.map((k) => {
        const c = f.campos?.[k];
        return c ? `${c.valor ?? ""} (${c.status ?? ""})` : "";
      }),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resultado-${result.competencia ?? "sem-data"}.csv`;
    a.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `resultado-${result.competencia ?? "sem-data"}.json`;
    a.click();
  };

  const conformes = hasFuncionarios
    ? result.funcionarios.filter((f) =>
        Object.values(f.campos ?? {}).every((c) => c.status !== "Inconsistente" && c.status !== "Não apresentado")
      ).length
    : 0;
  const total = result.total_funcionarios || result.funcionarios?.length || 0;
  const pct = total > 0 ? Math.round((conformes / total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Resultado da Análise</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {[result.empresa, result.competencia].filter(Boolean).join(" · ") || "Documento analisado"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {hasFuncionarios && (
              <button onClick={exportCSV} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                CSV
              </button>
            )}
            <button onClick={exportJSON} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              JSON
            </button>
            {onViewReport && (
              <button onClick={onViewReport} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ver Relatório
              </button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Tipo", value: result.tipo_documento || "—", icon: "📄" },
            { label: "Empresa", value: result.empresa || "—", icon: "🏢" },
            { label: "Competência", value: result.competencia || "—", icon: "📅" },
            {
              label: "Conformidade",
              value: total > 0 ? `${pct}%` : "—",
              icon: pct === 100 ? "✅" : pct >= 70 ? "⚠️" : "❌",
              sub: total > 0 ? `${conformes}/${total} funcionários` : null,
            },
          ].map(({ label, value, icon, sub }) => (
            <div key={label} className="bg-gray-800 rounded-xl border border-gray-700/50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
              <p className="font-semibold text-white truncate">{value}</p>
              {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Resumo */}
        {result.resumo && (
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-blue-400 mb-1">Resumo</p>
            <p className="text-sm text-gray-300">{result.resumo}</p>
          </div>
        )}

        {/* Inconsistências */}
        {result.inconsistencias?.length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full" />
              <h3 className="text-sm font-medium text-white">
                Inconsistências <span className="text-red-400">({result.inconsistencias.length})</span>
              </h3>
            </div>
            <ul className="divide-y divide-gray-700/30">
              {result.inconsistencias.map((inc, i) => (
                <li key={i} className="px-4 py-3 flex items-start gap-3">
                  <div className="w-5 h-5 bg-red-600/15 border border-red-600/20 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3 h-3 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium text-white">{inc.funcionario}</span>
                    <span className="text-gray-600 mx-1">·</span>
                    <span className="text-gray-400">{inc.campo}:</span>
                    <span className="text-gray-300 ml-1">{inc.descricao}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabela de funcionários */}
        {hasFuncionarios && (
          <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-white">Funcionários ({result.funcionarios.length})</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-900/50">
                    <th className="px-4 py-2.5 text-left text-gray-500 font-medium whitespace-nowrap">Funcionário</th>
                    {fieldKeys.map((c) => (
                      <th key={c} className="px-3 py-2.5 text-center text-gray-500 font-medium whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {result.funcionarios.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-700/20 transition-colors">
                      <td className="px-4 py-2.5 font-medium text-gray-200 whitespace-nowrap">{f.nome}</td>
                      {fieldKeys.map((k) => {
                        const v = f.campos?.[k];
                        const colors = {
                          "Apresentado": "text-emerald-400",
                          "Inconsistente": "text-red-400 font-medium",
                          "Não apresentado": "text-orange-400",
                          "Não consta": "text-gray-600",
                        };
                        return (
                          <td key={k} className={`px-3 py-2.5 text-center whitespace-nowrap ${colors[v?.status] ?? "text-gray-500"}`}>
                            {v?.status ?? "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Fallback JSON */}
        {!hasFuncionarios && (
          <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-white">Dados extraídos</h3>
            </div>
            <pre className="p-4 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
