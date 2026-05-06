function Section({ icon, title, children }) {
  return (
    <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-700/50 flex items-center gap-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function parseReport(text) {
  const sections = [];
  const lines = text.split("\n");
  let current = null;

  for (const line of lines) {
    const sectionMatch = line.match(/^(\d+)\.\s+(.+)$/);
    if (sectionMatch) {
      if (current) sections.push(current);
      current = { num: sectionMatch[1], title: sectionMatch[2].trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections;
}

function extractMeta(text) {
  const meta = {};
  const pairs = [
    ["contrato", /^Contrato\s*:\s*(.+)$/m],
    ["cliente", /^Cliente\s*:\s*(.+)$/m],
    ["edital", /^Edital\s*:\s*(.+)$/m],
    ["documento", /^Documento\s*:\s*(.+)$/m],
    ["empresa", /^Empresa\s*:\s*(.+)$/m],
    ["data", /^Data\s*:\s*(.+)$/m],
  ];
  for (const [k, re] of pairs) {
    const m = text.match(re);
    if (m) meta[k] = m[1].trim();
  }
  return meta;
}

const SECTION_ICONS = {
  "1": "🏷️",
  "2": "📋",
  "3": "⚠️",
  "4": "📊",
  "5": "⚖️",
  "6": "🔴",
  "7": "💡",
};

export default function ReportTab({ result }) {
  if (!result?.report_text) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <div className="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mb-4 border border-gray-700/50">
          <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-gray-500 font-medium">Relatório não disponível</p>
        <p className="text-sm text-gray-700 mt-1">Processe um documento para gerar o relatório FATO.</p>
      </div>
    );
  }

  const { report_text } = result;
  const meta = extractMeta(report_text);
  const sections = parseReport(report_text);

  const download = () => {
    const blob = new Blob([report_text], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio-fato-${result.competencia ?? "sem-data"}.txt`;
    a.click();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-600/20 rounded px-2 py-0.5 font-medium">RELATÓRIO FATO</span>
            </div>
            <h2 className="text-lg font-bold text-white">
              {meta.documento || "Relatório de Auditoria"}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {[meta.empresa, meta.data].filter(Boolean).join(" · ")}
            </p>
          </div>
          <button onClick={download} className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 flex-shrink-0">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Baixar .txt
          </button>
        </div>

        {/* Meta info */}
        {Object.keys(meta).length > 0 && (
          <div className="bg-gray-800 rounded-xl border border-gray-700/50 p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(meta).map(([k, v]) => (
              <div key={k}>
                <p className="text-xs text-gray-600 capitalize">{k}</p>
                <p className="text-sm text-gray-300 font-medium truncate">{v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Parsed sections */}
        {sections.length > 0 ? (
          <div className="space-y-3">
            {sections.map((sec) => (
              <Section key={sec.num} icon={SECTION_ICONS[sec.num] ?? "📌"} title={sec.title}>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">
                  {sec.lines.join("\n").trim() || "—"}
                </pre>
              </Section>
            ))}
          </div>
        ) : (
          <div className="bg-gray-800 rounded-xl border border-gray-700/50 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-700/50">
              <h3 className="text-sm font-medium text-white">Relatório completo</h3>
            </div>
            <pre className="p-5 text-xs text-gray-300 font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto">
              {report_text}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
