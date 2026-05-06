export default function ResultsTab({ result }) {
  if (!result) return <p className="p-4 text-gray-500">Nenhum resultado ainda.</p>;

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

  return (
    <div className="p-4 space-y-4 overflow-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Tipo", value: result.tipo_documento || "—" },
          { label: "Empresa", value: result.empresa || "—" },
          { label: "Competência", value: result.competencia || "—" },
          { label: "Funcionários", value: result.total_funcionarios ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-50 rounded-lg p-3 text-sm">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="font-semibold text-gray-800 truncate">{value}</p>
          </div>
        ))}
      </div>

      {/* Resumo */}
      {result.resumo && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-800">
          <span className="font-semibold">Resumo: </span>{result.resumo}
        </div>
      )}

      {/* Inconsistências */}
      {result.inconsistencias?.length > 0 && (
        <div>
          <h3 className="font-semibold text-red-600 mb-2 text-sm">
            Inconsistências ({result.inconsistencias.length})
          </h3>
          <ul className="space-y-1">
            {result.inconsistencias.map((inc, i) => (
              <li key={i} className="bg-red-50 rounded p-2 text-sm">
                <span className="font-medium">{inc.funcionario}</span>
                {" — "}
                <span className="text-gray-600">{inc.campo}:</span> {inc.descricao}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Tabela de funcionários */}
      {hasFuncionarios && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-sm">Funcionários</h3>
            <button
              onClick={exportCSV}
              className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
            >
              Exportar CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border px-2 py-1 text-left whitespace-nowrap">Funcionário</th>
                  {fieldKeys.map((c) => (
                    <th key={c} className="border px-2 py-1 whitespace-nowrap">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.funcionarios.map((f, i) => (
                  <tr key={i} className="odd:bg-white even:bg-gray-50">
                    <td className="border px-2 py-1 font-medium whitespace-nowrap">{f.nome}</td>
                    {fieldKeys.map((k) => {
                      const v = f.campos?.[k];
                      return (
                        <td key={k} className={`border px-2 py-1 text-center whitespace-nowrap ${
                          v?.status === "Inconsistente" ? "text-red-600 bg-red-50"
                          : v?.status === "Não apresentado" ? "text-orange-500"
                          : v?.status === "Apresentado" ? "text-green-600"
                          : "text-gray-500"
                        }`}>
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

      {/* Fallback: raw JSON if no structured data */}
      {!hasFuncionarios && (
        <pre className="bg-gray-900 text-green-300 text-xs p-4 rounded overflow-auto max-h-[50vh] whitespace-pre-wrap">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
