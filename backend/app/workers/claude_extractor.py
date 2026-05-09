import json
import logging
import re

import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

_gemini_model = None


def _get_gemini():
    global _gemini_model
    if _gemini_model is None:
        genai.configure(api_key=settings.gemini_api_key)
        _gemini_model = genai.GenerativeModel("gemini-1.5-flash")
    return _gemini_model


def _build_prompt(text_block: str, fields: list[str], contrato: dict, batch_num: int, total_batches: int) -> str:
    fields_list = ", ".join(fields) if fields else "todos os campos disponíveis"
    contrato_info = (
        f"Contrato: {contrato.get('name', '')}, "
        f"Cliente: {contrato.get('client', '')}, "
        f"Edital: {contrato.get('edital', '')}"
    )

    return f"""Você é um especialista em auditoria de contratos trabalhistas brasileiros.
Analise o texto extraído do documento abaixo e extraia os dados dos funcionários.

Contexto do contrato: {contrato_info}
Lote: {batch_num}/{total_batches}
Campos solicitados: {fields_list}

TEXTO DO DOCUMENTO:
{text_block}

Instruções:
- Extraia os dados de TODOS os funcionários presentes no texto
- Para cada campo, indique o status: "Apresentado" (encontrado), "Ausente" (não encontrado) ou "Inconsistente" (valor suspeito)
- Identifique inconsistências como valores zerados, datas inválidas ou dados faltantes
- Seja preciso com nomes, CPFs, valores e datas

Retorne SOMENTE JSON válido neste formato:
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
    {{"funcionario": "nome", "campo": "campo", "descricao": "descrição do problema"}}
  ],
  "resumo": "texto resumindo o lote"
}}"""


def _parse_response(text: str) -> dict:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group())
    return json.loads(text)


def _call_gemini(text_block: str, prompt: str) -> dict:
    model = _get_gemini()
    response = model.generate_content(prompt)
    return _parse_response(response.text)


def _call_gemini_with_fallback(text_block: str, prompt: str) -> dict:
    """Try Gemini; if quota exceeded, try alternative models."""
    models_to_try = ["gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.0-pro"]
    last_error = None

    for model_name in models_to_try:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            logger.info("Used model: %s", model_name)
            return _parse_response(response.text)
        except Exception as e:
            last_error = e
            logger.warning("Model %s failed: %s", model_name, e)
            continue

    raise Exception(f"All Gemini models failed. Last error: {last_error}")


def extract_from_pages(
    pages: list[dict],
    fields: list[str],
    contrato: dict,
    batch_size: int = 20,
) -> list[dict]:
    """
    Extract structured data from text pages using Gemini.
    pages: list of {page, text, method} dicts from pdf_processor.extract_text_from_pdf()
    """
    from app.workers.pdf_processor import pages_to_text_block

    results = []
    # Filter out empty pages
    non_empty = [p for p in pages if p.get("text")]

    if not non_empty:
        logger.warning("No text pages to process — all pages were empty")
        return results

    # Split into batches to avoid token limits
    batches = [non_empty[i:i + batch_size] for i in range(0, len(non_empty), batch_size)]
    total_batches = len(batches)

    for batch_num, batch_pages in enumerate(batches, start=1):
        text_block = pages_to_text_block(batch_pages)
        prompt = _build_prompt(text_block, fields, contrato, batch_num, total_batches)

        try:
            result = _call_gemini_with_fallback(text_block, prompt)
            results.append(result)
            logger.info("Batch %d/%d extracted successfully", batch_num, total_batches)
        except Exception as e:
            logger.error("Batch %d/%d failed: %s", batch_num, total_batches, e)
            results.append({"error": str(e), "batch": batch_num})

    return results
