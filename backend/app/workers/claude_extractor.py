import re
import logging
import time
import google.generativeai as genai

from app.config import settings

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-flash-8b",
]


def _build_prompt(text_block, fields, contrato, batch_num, total_batches):
    fields_list = ", ".join(fields) if fields else "todos os campos disponiveis"
    contrato_info = (
        "Contrato: " + str(contrato.get("name", "")) + ", "
        "Cliente: " + str(contrato.get("client", "")) + ", "
        "Edital: " + str(contrato.get("edital", ""))
    )
    parts = [
        "Voce e um especialista em auditoria de contratos trabalhistas brasileiros.",
        "Analise o texto extraido do documento abaixo e extraia os dados dos funcionarios.",
        "",
        "Contexto do contrato: " + contrato_info,
        "Lote: " + str(batch_num) + "/" + str(total_batches),
        "Campos solicitados: " + fields_list,
        "",
        "TEXTO DO DOCUMENTO:",
        text_block,
        "",
        "Instrucoes:",
        "- Extraia os dados de TODOS os funcionarios presentes no texto",
        "- Para cada campo: Apresentado, Ausente ou Inconsistente",
        "- Retorne SOMENTE um JSON valido, sem markdown, sem explicacoes",
        "",
        "Formato:",
        "[{nome: Nome, cpf: 000, campos: {campo1: {status: Apresentado, valor: x}}}]"
    ]
    return "\n".join(parts)


def _parse_response(text):
    text = text.strip()
    if text.startswith("```"):
        text_lines = text.split("\n")
        text_lines = [l for l in text_lines if not l.startswith("```")]
        text = "\n".join(text_lines)
    import json
    try:
        return json.loads(text)
    except Exception:
        import re as re2
        match = re2.search(r"\[.*\]", text, re2.DOTALL)
        if match:
            try:
                return json.loads(match.group())
            except Exception:
                pass
    return []


def _call_gemini(prompt):
    last_error = None
    for model_name in GEMINI_MODELS:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            logger.info("Gemini respondeu com modelo %s", model_name)
            return _parse_response(response.text)
        except Exception as exc:
            last_error = exc
            err_str = str(exc)
            logger.warning("Modelo %s falhou: %s", model_name, err_str)
            if "429" in err_str or "quota" in err_str.lower():
                time.sleep(30)
                continue
            if "404" in err_str or "deprecated" in err_str.lower() or "not found" in err_str.lower():
                continue
    raise RuntimeError("Todos os modelos Gemini falharam. Ultimo erro: " + str(last_error))


def _call_anthropic(prompt):
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        message = client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        logger.info("Anthropic respondeu com sucesso")
        return _parse_response(message.content[0].text)
    except Exception as exc:
        logger.error("Anthropic falhou: %s", exc)
        raise


def extract_with_gemini(text, fields, contrato, batch_num=1, total_batches=1):
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY nao configurada")
    prompt = _build_prompt(text, fields, contrato, batch_num, total_batches)
    return _call_gemini(prompt)


def extract_with_anthropic(text, fields, contrato, batch_num=1, total_batches=1):
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY nao configurada")
    prompt = _build_prompt(text, fields, contrato, batch_num, total_batches)
    return _call_anthropic(prompt)


def extract_data(text, fields, contrato, batch_num=1, total_batches=1):
    has_gemini = bool(settings.gemini_api_key)
    has_anthropic = bool(settings.anthropic_api_key)
    if has_gemini:
        try:
            return extract_with_gemini(text, fields, contrato, batch_num, total_batches)
        except Exception as gemini_exc:
            logger.warning("Gemini falhou, tentando Anthropic: %s", gemini_exc)
            if has_anthropic:
                try:
                    return extract_with_anthropic(text, fields, contrato, batch_num, total_batches)
                except Exception as anthropic_exc:
                    logger.error("Ambos falharam. Gemini: %s, Anthropic: %s", gemini_exc, anthropic_exc)
                    raise RuntimeError(
                        "Extracao falhou. Gemini: " + str(gemini_exc) + ", Anthropic: " + str(anthropic_exc)
                    ) from anthropic_exc
            raise
    if has_anthropic:
        return extract_with_anthropic(text, fields, contrato, batch_num, total_batches)
    raise RuntimeError(
        "Nenhuma chave de IA configurada. Defina GEMINI_API_KEY e/ou ANTHROPIC_API_KEY."
    )


def extract_from_pages(pages, fields, contrato):
    """Compatibilidade com tasks.py. pages = lista de dicts {page, text, method}."""
    all_text = []
    for p in pages:
        text = p.get("text", "") if isinstance(p, dict) else str(p)
        if text.strip():
            all_text.append(text)
    if not all_text:
        logger.warning("Nenhum texto extraido das paginas do PDF")
        return []
    separator = "\n\n--- PAGINA ---\n\n"
    full_text = separator.join(all_text)
    max_chars = 50000
    if len(full_text) <= max_chars:
        return extract_data(full_text, fields, contrato, 1, 1)
    chunks = []
    start = 0
    while start < len(full_text):
        chunks.append(full_text[start:start + max_chars])
        start += max_chars
    total = len(chunks)
    results = []
    for i, chunk in enumerate(chunks, 1):
        logger.info("Processando lote %d/%d", i, total)
        batch_result = extract_data(chunk, fields, contrato, i, total)
        results.extend(batch_result)
    return results
