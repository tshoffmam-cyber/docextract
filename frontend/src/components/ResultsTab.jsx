export default function ResultsTab({ result }) {
  if (!result) return <p className="p-4 text-gray-500">Nenhum resultado ainda.</p>;

  return (
    <div className="p-4 space-y-4 overflow-auto">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div><span className="font-semibold">Tipo:</span> {result.tipo_documento}</div>
        <div><span className="font-semibold">Empresa:</span> {result.empresa}</div>
        <div><span className="font-semibold">Competência:</span> {result.competencia}</div>
      </div>
      <p className="text-sm"><span className="font-semibold">Funcionários:</span> {result.total_funcionarios}</p>

      {result.inconsistencias?.length > 0 && (
        <div>
          <h3 className="font-semibold text-red-600 mb-1">Inconsistências ({result.inconsistencias.length})</h3>
          <ul className="text-sm space-y-1">
            {result.inconsistencias.map((inc, i) => (
              <li key={i} className="bg-red-50 rounded p-2">
                <span className="font-medium">{inc.funcionario}</span> — {inc.campo}: {inc.descricao}
              </li>
            ))}
          </ul>
        </div>
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
                  <td key={j} className={`border px-2 py-1 text-center ${
                    v.status === "Inconsistente" ? "text-red-600"
                    : v.status === "Não apresentado" ? "text-orange-500"
                    : "text-green-600"
                  }`}>
                    {v.status}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
