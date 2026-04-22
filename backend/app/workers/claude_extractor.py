import json
import logging
import re

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

STATUS_VALUES = ("Apresentado", "Não apresentado", "Não consta", "Inconsistente")


def _build_prompt(fields: list[str], contrato: dict, batch_num: int, total_batches: int) -> str:
    fields_list = ", ".join(fields) if fields else "todos os campos disponíveis"
    contrato_info = f"Contrato: {contrato.get('name', '')}, Cliente: {contrato.get('client', '')}, Edital: {contrato.get('edital', '')}" if contrato else ""
    return f"""Você é um auditor especialista em documentação trabalhista brasileira.
{contrato_info}
Lote {batch_num}/{total_batches}. Analise as imagens e extraia dados de TODOS os funcionários visíveis.

Campos a extrair por funcionário: {fields_list}

Para cada campo use os status:
- "Apresentado" → documento/valor presente e correto
- "Não apresentado" → deveria existir mas está ausente
- "Não consta" → campo inexistente neste tipo de documento
- "Inconsistente" → divergência ou valor suspeito

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


def deduplicate_employees(employees: list[dict]) -> list[dict]:
    merged: dict[str, dict] = {}
    for emp in employees:
        key = emp.get("nome", "").strip().upper()
        if not key:
            continue
        if key not in merged:
            merged[key] = emp
        else:
            existing = merged[key]
            existing_campos = existing.get("campos", {})
            for campo, data in emp.get("campos", {}).items():
                if campo not in existing_campos:
                    existing_campos[campo] = data
                else:
                    current_status = existing_campos[campo].get("status", "")
                    new_status = data.get("status", "")
                    # Prefer more informative statuses over "Não consta"
                    if current_status == "Não consta" and new_status != "Não consta":
                        existing_campos[campo] = data
            existing["campos"] = existing_campos
    return list(merged.values())


def extract_from_pages(pages_b64: list[str], fields: list[str], contrato: dict) -> dict:
    batch_size = settings.batch_size
    batches = [pages_b64[i : i + batch_size] for i in range(0, len(pages_b64), batch_size)]
    total_batches = len(batches)

    all_employees: list[dict] = []
    all_inconsistencies: list[dict] = []
    tipo_documento = ""
    competencia = ""
    empresa = ""
    resumos: list[str] = []

    for idx, batch in enumerate(batches, start=1):
        content: list[dict] = []
        for b64 in batch:
            content.append({
                "type": "image",
                "source": {"type": "base64", "media_type": "image/jpeg", "data": b64},
            })
        content.append({"type": "text", "text": _build_prompt(fields, contrato, idx, total_batches)})

        try:
            response = client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=4096,
                messages=[{"role": "user", "content": content}],
            )
            parsed = _parse_response(response.content[0].text)
            all_employees.extend(parsed.get("funcionarios", []))
            all_inconsistencies.extend(parsed.get("inconsistencias", []))
            if not tipo_documento:
                tipo_documento = parsed.get("tipo_documento", "")
            if not competencia:
                competencia = parsed.get("competencia", "")
            if not empresa:
                empresa = parsed.get("empresa", "")
            if parsed.get("resumo"):
                resumos.append(parsed["resumo"])
        except Exception as e:
            logger.error("Batch %d/%d extraction failed: %s", idx, total_batches, e)
            continue

    deduped = deduplicate_employees(all_employees)
    return {
        "tipo_documento": tipo_documento,
        "competencia": competencia,
        "empresa": empresa,
        "total_funcionarios": len(deduped),
        "funcionarios": deduped,
        "inconsistencias": all_inconsistencies,
        "resumo": " | ".join(resumos),
    }
