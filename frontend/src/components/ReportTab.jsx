export default function ReportTab({ result }) {
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
