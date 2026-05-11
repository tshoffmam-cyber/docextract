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


def _build_prompt(text_block: str, fields: list, contrato: dict, batch_num: int, total_batches: int) -> str:
    fields_list = ", ".join(fields) if fields else "todos os campos disponíveis"
    contrato_info = (
        f"Contrato: {contrato.get('name', '')}, "
        f"Cliente: {contrato.get('client', '')}, "
        f"Edital: {contrato.get('edital', '')}"
    )
    prompt = (
        "Voce e um especialista em auditoria de contratos trabalhistas brasileiros.\n"
        "Analise o texto extraido do documento abaixo e extraia os dados dos funcionarios.\n\n"
        f"Contexto do contrato: {contrato_info}\n"
        f"Lote: {batch_num}/{total_batches}\n"
        f"Campos solicitados: {fields_list}\n\n"
        "TEXTO DO DOCUMENTO:\n"
        f"{text_block}\n\n"
        "Instrucoes:\n"
        "- Extraia os dados de TODOS os funcionarios presentes no texto\n"
        "- Para cada campo, indique o status: Apresentado (encontrado), Ausente (nao encontrado) ou Inconsistente\n"
        "- Retorne SOMENTE um JSON valido, sem markdown, sem explicacoes\n\n"
        "Formato esperado:\n"
        '[{"nome": "Nome", "cpf": "000.000.000-00", "campos": {"campo1": {"status": "Apresentado", "valor": "x"}}}]'
    )
    return prompt


def _parse_response(text: str) -> list:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = [l for l in lines if not l.startswith("```")]
        text = "\n".join(lines)
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


def extract_with_gemini(text: str, fields: list, contrato: dict, batch_num: int = 1, total_batches: int = 1) -> list:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY nao configurada")
    prompt = _build_prompt(text, fields, contrato, batch_num, total_batches)
    last_error = None
    for model_name in GEMINI_MODELS:
        try:
            genai.configure(api_key=settings.gemini_api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            logger.info("IA respondeu com modelo %s", model_name)
            return _parse_response(response.text)
        except Exception as exc:
            last_error = exc
            err_str = str(exc)
            logger.warning("Modelo %s falhou: %s", model_name, err_str)
            if "429" in err_str or "quota" in err_str.lower():
                time.sleep(30)
                continue
            if "404" in err_str or "deprecated" in err_str.lower() or "not found" in err_str.lower():
                logger.warning("Modelo %s nao disponivel", model_name)
                continue
    raise RuntimeError(f"Todos os modelos Gemini falharam. Ultimo erro: {last_error}") from last_error


def extract_with_anthropic(text: str, fields: list, contrato: dict, batch_num: int = 1, total_batches: int = 1) -> list:
    if not settings.anthropic_api_key:
        raise ValueError("ANTHROPIC_API_KEY nao configurada")
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        prompt = _build_prompt(text, fields, contrato, batch_num, total_batches)
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


def extract_data(text: str, fields: list, contrato: dict, batch_num: int = 1, total_batches: int = 1) -> list:
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
                    logger.error("Ambos provedores falharam. Gemini: %s, Anthropic: %s", gemini_exc, anthropic_exc)
                    raise RuntimeError(
                        f"Extracao falhou. Gemini: {gemini_exc}, Anthropic: {anthropic_exc}"
                    ) from anthropic_exc
            raise
    if has_anthropic:
        return extract_with_anthropic(text, fields, contrato, batch_num, total_batches)
    raise RuntimeError(
        "Nenhuma chave de IA configurada. "
        "Defina GEMINI_API_KEY e/ou ANTHROPIC_API_KEY."
    )
