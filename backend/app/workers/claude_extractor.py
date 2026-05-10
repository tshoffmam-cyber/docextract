import json
import logging
import re
import time

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Gemini helpers
# ---------------------------------------------------------------------------

# Ordered list of models to try - prefer current/stable models first
GEMINI_MODELS = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
]


def _build_prompt(
            text_block: str,
            fields: list[str],
            contrato: dict,
            batch_num: int,
            total_batches: int,
) -> str:
            fields_list = ", ".join(fields) if fields else "todos os campos disponíveis"
            contrato_info = (
                f"Contrato: {contrato.get('name', '')}, "
                f"Cliente: {contrato.get('client', '')}, "
                f"Edital: {contrato.get('edital', '')}"
            )

    return f"""Voce e um especialista em auditoria de contratos trabalhistas brasileiros.
    Analise o texto extraido do documento abaixo e extraia os dados dos funcionarios.

    Contexto do contrato: {contrato_info}
    Lote: {batch_num}/{total_batches}
    Campos solicitados: {fields_list}

    TEXTO DO DOCUMENTO:
    {text_block}

    Instrucoes:
    - Extraia os dados de TODOS os funcionarios presentes no texto
    - Para cada campo, indique o status: "Apresentado" (encontrado), "Ausente" (nao encontrado) ou "Inconsistente" (valor suspeito)
    - Identifique inconsistencias como valores zerados, datas invalidas ou dados faltantes
    - Seja preciso com nomes, CPFs, valores e datas

    Retorne SOMENTE JSON valido neste formato:
    {{
        "tipo_documento": "holerite|fgts|vt|ponto|aso|outro",
            "competencia": "MM/AAAA",
                "empresa": "nome da empresa",
                    "total_funcionarios": 0,
                        "funcionarios": [
                                {{
                                            "nome": "NOME COMPLETO",
                                                        "campos": {{
                                                                        "campo_nome": {{"valor": "...", "status": "Apresentado"}}
                                                                                    }}
                                                                                            }}
                                                                                                ],
                                                                                                    "inconsistencias": [
                                                                                                            {{"funcionario": "nome", "campo": "campo", "descricao": "descricao do problema"}}
                                                                                                                ],
                                                                                                                    "resumo": "texto resumindo o lote"
}}"""


def _parse_response(text: str) -> dict:
            match = re.search(r"\{.*\}", text, re.DOTALL)
            if match:
                            return json.loads(match.group())
                        return json.loads(text)


def _call_gemini_with_fallback(prompt: str) -> dict:
            """Try each Gemini model in order; raise if all fail."""
    if not settings.gemini_api_key:
                    raise RuntimeError(
                                        "GEMINI_API_KEY nao configurada. "
                                        "Defina a variavel de ambiente GEMINI_API_KEY no painel do Railway/Hostinger."
                    )

    last_error: Exception | None = None

    for model_name in GEMINI_MODELS:
                    try:
                                        genai.configure(api_key=settings.gemini_api_key)
                                        model = genai.GenerativeModel(model_name)
                                        response = model.generate_content(prompt)
                                        logger.info("IA respondeu com modelo: %s", model_name)
                                        return _parse_response(response.text)
except Exception as exc:
            last_error = exc
            err_str = str(exc)
            logger.warning("Modelo %s falhou: %s", model_name, err_str)

            # Se for cota esgotada (429), espera retry_delay antes de tentar proximo
            retry_match = re.search(r"retry_delay\s*\{\s*seconds:\s*(\d+)", err_str)
            if retry_match:
                                    wait = min(int(retry_match.group(1)), 10)  # maximo 10 s de espera
                logger.info("Aguardando %ds antes de tentar proximo modelo...", wait)
                time.sleep(wait)

            continue

    raise Exception(f"Todos os modelos Gemini falharam. Ultimo erro: {last_error}")


# ---------------------------------------------------------------------------
# Fallback para Anthropic Claude (quando Gemini nao tem cota)
# ---------------------------------------------------------------------------

def _call_anthropic_fallback(prompt: str) -> dict:
            """Use Anthropic Claude as last-resort fallback when Gemini is unavailable."""
    if not settings.anthropic_api_key:
                    raise RuntimeError("ANTHROPIC_API_KEY tambem nao configurada - sem IA disponivel.")

    try:
                    import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
                            model="claude-sonnet-4-5",
                            max_tokens=4096,
                            messages=[{"role": "user", "content": prompt}],
        )
        text = message.content[0].text
        logger.info("Resposta obtida via Anthropic Claude (fallback)")
        return _parse_response(text)
except Exception as exc:
        raise Exception(f"Anthropic Claude tambem falhou: {exc}") from exc


def _call_ai(prompt: str) -> dict:
            """Call Gemini first; if all Gemini models fail, fall back to Anthropic."""
    try:
                    return _call_gemini_with_fallback(prompt)
except Exception as gemini_exc:
        logger.warning("Gemini indisponivel (%s). Tentando Anthropic...", gemini_exc)
        try:
                            return _call_anthropic_fallback(prompt)
except Exception as anthropic_exc:
            raise Exception(
                                    f"Nenhuma IA disponivel. "
                                    f"Gemini: {gemini_exc} | Anthropic: {anthropic_exc}"
            ) from anthropic_exc


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_from_pages(
            pages: list[dict],
            fields: list[str],
            contrato: dict,
            batch_size: int = 20,
) -> list[dict]:
            """
                Extract structured data from text pages using AI (Gemini -> Anthropic fallback).
                    pages: list of {page, text, method} dicts from pdf_processor.extract_text_from_pdf()
                        """
    from app.workers.pdf_processor import pages_to_text_block

    results = []
    non_empty = [p for p in pages if p.get("text")]

    if not non_empty:
                    logger.warning("Nenhuma pagina com texto para processar - todas estavam vazias")
                    return results

    batches = [non_empty[i : i + batch_size] for i in range(0, len(non_empty), batch_size)]
    total_batches = len(batches)

    for batch_num, batch_pages in enumerate(batches, start=1):
                    text_block = pages_to_text_block(batch_pages)
                    prompt = _build_prompt(text_block, fields, contrato, batch_num, total_batches)

        try:
                            result = _call_ai(prompt)
                            results.append(result)
                            logger.info("Lote %d/%d extraido com sucesso", batch_num, total_batches)
except Exception as exc:
            logger.error("Lote %d/%d falhou: %s", batch_num, total_batches, exc)
            results.append({"error": str(exc), "batch": batch_num})

    return results
