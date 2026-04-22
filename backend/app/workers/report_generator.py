from datetime import date


def generate_fato_report(parsed: dict, contrato: dict, results: list) -> str:
    hoje = date.today().strftime("%d/%m/%Y")
    tipo = parsed.get("tipo_documento", "Documento").upper()
    empresa = parsed.get("empresa", "N/A")
    competencia = parsed.get("competencia", "N/A")
    funcionarios = parsed.get("funcionarios", [])
    inconsistencias = parsed.get("inconsistencias", [])
    resumo = parsed.get("resumo", "")

    total = len(funcionarios)
    pendentes = len(inconsistencias)
    conformes = total - pendentes
    pct = round((conformes / total * 100), 1) if total > 0 else 0.0

    classificacao = "Eficaz" if pendentes == 0 else "Melhorias Requeridas"

    contrato_name = contrato.get("name", "N/A")
    contrato_client = contrato.get("client", "N/A")
    edital = contrato.get("edital", "N/A")

    linhas_inconsistencias = ""
    for i, inc in enumerate(inconsistencias, start=1):
        func_nome = inc.get("funcionario", "N/A")
        campo = inc.get("campo", "N/A")
        descricao = inc.get("descricao", "N/A")
        linhas_inconsistencias += f"  {i}. [{func_nome}] {campo}: {descricao}\n"

    if not linhas_inconsistencias:
        linhas_inconsistencias = "  Nenhuma inconsistência identificada.\n"

    report = f"""================================================================================
RELATÓRIO FATO — DocExtract
================================================================================
Contrato : {contrato_name}
Cliente  : {contrato_client}
Edital   : {edital}
Documento: {tipo} — Competência {competencia}
Empresa  : {empresa}
Data     : {hoje}
--------------------------------------------------------------------------------

1. CLASSIFICAÇÃO
   {classificacao}

2. EVIDÊNCIAS
   {resumo or f"Análise de {tipo} da empresa {empresa} referente à competência {competencia}."}

3. INCONSISTÊNCIAS IDENTIFICADAS
{linhas_inconsistencias}
4. RESUMO QUANTITATIVO
   Total de funcionários analisados : {total}
   Conformes                        : {conformes}
   Pendentes / Inconsistências      : {pendentes}
   Índice de conformidade           : {pct}%

5. BASE LEGAL
   - Edital {edital}, Cláusulas de Obrigações Trabalhistas
   - CLT — Consolidação das Leis do Trabalho
   - Lei 8.036/90 (FGTS)
   - NR-7 (PCMSO / ASO)

6. RISCO / CONSEQUÊNCIA
   {"Baixo — documentação em conformidade." if pendentes == 0 else f"Médio/Alto — {pendentes} irregularidade(s) identificada(s). Risco de autuação trabalhista e descumprimento contratual."}

7. RECOMENDAÇÕES
   {"Manter o padrão de apresentação documental." if pendentes == 0 else "Regularizar as pendências identificadas antes da próxima medição. Notificar a empresa contratada formalmente."}

--------------------------------------------------------------------------------
Fiscal responsável: ___________________________     Data: {hoje}
Gerado pelo DocExtract — Sistema de Auditoria Inteligente de Contratos Públicos
================================================================================
"""
    return report
