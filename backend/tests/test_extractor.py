import json
from unittest.mock import MagicMock, patch

import pytest

from app.workers.claude_extractor import deduplicate_employees, extract_from_pages


def _mock_response(payload: dict) -> MagicMock:
    msg = MagicMock()
    msg.content = [MagicMock(text=json.dumps(payload))]
    return msg


BATCH_PAYLOAD = {
    "tipo_documento": "holerite",
    "competencia": "01/2024",
    "empresa": "Empresa Teste Ltda",
    "total_funcionarios": 2,
    "funcionarios": [
        {"nome": "João Silva", "campos": {"Holerite": {"valor": "sim", "status": "Apresentado"}}},
        {"nome": "Maria Souza", "campos": {"Holerite": {"valor": "não", "status": "Não apresentado"}}},
    ],
    "inconsistencias": [
        {"funcionario": "Maria Souza", "campo": "Holerite", "descricao": "Documento ausente"}
    ],
    "resumo": "Lote processado com sucesso.",
}


@patch("app.workers.claude_extractor.client")
def test_extract_returns_structure(mock_client):
    mock_client.messages.create.return_value = _mock_response(BATCH_PAYLOAD)
    result = extract_from_pages(["fakebase64"], ["Holerite"], {})
    assert "funcionarios" in result
    assert "inconsistencias" in result
    assert result["tipo_documento"] == "holerite"
    assert result["empresa"] == "Empresa Teste Ltda"


@patch("app.workers.claude_extractor.client")
def test_extract_processes_in_batches(mock_client, monkeypatch):
    from app.config import settings
    monkeypatch.setattr(settings, "batch_size", 2)
    mock_client.messages.create.return_value = _mock_response(BATCH_PAYLOAD)

    pages = ["b64"] * 5  # 5 páginas → 3 lotes (2+2+1)
    extract_from_pages(pages, [], {})
    assert mock_client.messages.create.call_count == 3


def test_deduplicate_merges_by_name():
    employees = [
        {"nome": "joão silva", "campos": {"A": {"valor": "x", "status": "Apresentado"}, "B": {"valor": "", "status": "Não consta"}}},
        {"nome": "JOÃO SILVA", "campos": {"A": {"valor": "x", "status": "Apresentado"}, "B": {"valor": "y", "status": "Apresentado"}}},
    ]
    result = deduplicate_employees(employees)
    assert len(result) == 1
    assert result[0]["campos"]["B"]["status"] == "Apresentado"


def test_deduplicate_prefers_non_nao_consta():
    employees = [
        {"nome": "Ana Lima", "campos": {"FGTS": {"valor": "", "status": "Não consta"}}},
        {"nome": "ANA LIMA", "campos": {"FGTS": {"valor": "ok", "status": "Apresentado"}}},
    ]
    result = deduplicate_employees(employees)
    assert result[0]["campos"]["FGTS"]["status"] == "Apresentado"


def test_deduplicate_empty_list():
    assert deduplicate_employees([]) == []


@patch("app.workers.claude_extractor.client")
def test_extract_continues_on_batch_error(mock_client):
    mock_client.messages.create.side_effect = [
        Exception("API error"),
        _mock_response(BATCH_PAYLOAD),
    ]
    result = extract_from_pages(["b64", "b64"], [], {})
    assert isinstance(result["funcionarios"], list)
