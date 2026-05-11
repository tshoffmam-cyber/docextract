import re
import logging
import time
from pathlib import Path
import google.generativeai as genai

logger = logging.getLogger(__name__)

GEMINI_MODELS = [
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
]

ENV_FILE = Path("/opt/docextract/backend/.env")


def _get_api_key(key_name: str) -> str | None:
        """Le a chave diretamente do .env em runtime para suportar atualizacao via UI."""
        if ENV_FILE.exists():
                    for line in ENV_FILE.read_text().splitlines():
                                    line = line.strip()
                                    if line.startswith("#") or "=" not in line:
                                                        continue
                                                    k, _, v = line.partition("=")
                                    if k.strip() == key_name:
                                                        val = v.strip()
                                                        return val if val else None
                                            # fallback: variavel de ambiente do processo
                                            import os
                            return os.environ.get(key_name)


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
        "REGRAS:",
                "1. Retorne APENAS um array JSON valido, sem markdown, sem texto antes ou depois.",
                "2. Cada elemento do array representa UM funcionario.",
                "3. Use null para campos ausentes ou ilegíveis.",
                "4. NAO invente dados. Se nao encontrar, use null.",
                "5. Preserve todos os dados exatamente como aparecem no documento.",
                "6. Nao perca nenhuma informacao - se houver duvida, inclua o campo.",
                "",
                "TEXTO DO DOCUMENTO:",
                                text_block,
    ]
    return "\n".join(parts)


def _parse_response(text: str) -> list:
        text = text.strip()
    # Remove markdown code blocks if present
    text = re.sub(r"```(?:json)?\s*", "", text)
    text = re.sub(r"```\s*$", "", text)
    text = text.strip()
    # Find JSON array
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
                logger.warning("Resposta nao contem array JSON: %s", text[:200])
        return []
    json_str = text[start : end + 1]
    try:
        import json
        data = json.loads(json_str)
        if isinstance(data, list):
                        return data
        return [data]
except Exception as exc:
        logger.error("Erro ao parsear JSON: %s | Texto: %s", exc, json_str[:500])
        # Try to extract partial data
        try:
                        import json
            matches = re.findall(r"\{[^{}]+\}", json_str, re.DOTALL)
            result = []
            for m in matches:
                try:
                                        result.append(json.loads(m))
                except Exception:
                    pass
            return result
except Exception:
            pass
    return []


def _call_gemini(prompt):
    api_key = _get_api_key("GEMINI_API_KEY")
            if not api_key:
        raise ValueError("GEMINI_API_KEY nao configurada. Acesse Configuracoes na interface para adicionar a chave.")

    last_error = None
    for model_name in GEMINI_MODELS:
                try:
                                genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            logger.info("Gemini respondeu com modelo %s", model_name)
            return _parse_response(response.text)
except Exception as exc:
            last_error = exc
            err_str = str(exc)
            logger.warning("Modelo %s falhou: %s", model_name, err_str)
            if "429" in err_str or "quota" in err_str.lower():
                                logger.info("Quota atingida no modelo %s, tentando proximo...", model_name)
                    time.sleep(2)
                continue
            if "API_KEY_INVALID" in err_str or "invalid api key" in err_str.lower():
                                raise ValueError("GEMINI_API_KEY invalida. Verifique a chave em Configuracoes.") from exc
                            # For other errors, try next model
                            continue

    raise RuntimeError(f"Todos os modelos Gemini falharam. Ultimo erro: {last_error}") from last_error


def extract_from_pages(pages: list[dict], fields: list[str], contrato: dict, batch_size: int = 15) -> list[dict]:
        """
            Processa paginas do PDF em lotes e extrai dados via Gemini.

                Args:
                        pages: lista de {page, text, method} retornada pelo pdf_processor
                                fields: campos a extrair
                                        contrato: dados do contrato (name, client, edital)
                                                batch_size: numero de paginas por lote

                                                    Returns:
                                                            lista de dicts com dados extraidos dos funcionarios
                                                                """
    if not pages:
                logger.warning("Nenhuma pagina para processar")
                return []

    all_results = []
    total_batches = (len(pages) + batch_size - 1) // batch_size

    for batch_num, start in enumerate(range(0, len(pages), batch_size), 1):
                batch = pages[start : start + batch_size]
                text_block = "\n\n--- PAGINA {page} ({method}) ---\n{text}".join(
                    f"\n\n--- PAGINA {p['page']} ({p['method']}) ---\n{p['text']}"
                    for p in batch
                    if p.get("text", "").strip()
                )

        if not text_block.strip():
                        logger.info("Lote %d/%d sem texto, pulando", batch_num, total_batches)
                        continue

        logger.info(
                        "Processando lote %d/%d (%d paginas, %d chars)",
                        batch_num, total_batches, len(batch), len(text_block)
        )

        try:
                        results = _call_gemini(_build_prompt(text_block, fields, contrato, batch_num, total_batches))
                        logger.info("Lote %d/%d: %d registros extraidos", batch_num, total_batches, len(results))
                        all_results.extend(results)
except ValueError as exc:
                # API key problems - raise immediately, no point retrying
                raise
except Exception as exc:
                logger.error("Erro no lote %d/%d: %s", batch_num, total_batches, exc)
                # Continue with other batches even if one fails
                continue

    logger.info("Total extraido: %d registros de %d paginas", len(all_results), len(pages))
    return all_results
