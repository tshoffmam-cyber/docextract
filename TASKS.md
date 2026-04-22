# DocExtract — Tasks para Claude Code

> Cole este arquivo na raiz do projeto e rode no Claude Code:
> `claude "leia o TASKS.md e execute todas as tarefas em ordem"`

---

## CONTEXTO DO PROJETO

DocExtract é um sistema de auditoria inteligente de contratos públicos (CESAN/ES).
Automatiza a extração de dados de PDFs trabalhistas (holerites, FGTS, VT, ponto, ASO)
e gera relatórios de auditoria no formato FATO automaticamente.

**Stack:**
- Backend: Python + FastAPI + Celery + Redis + PostgreSQL
- Frontend: React + Vite + Tailwind CSS
- IA: Anthropic Claude API (claude-sonnet-4-20250514)
- Storage: Cloudflare R2
- Deploy: Railway (backend) + Vercel (frontend)

---

## TASK 1 — Estrutura do Projeto

Crie a seguinte estrutura de pastas e arquivos vazios:

```
docextract/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI app principal
│   │   ├── config.py                # Variáveis de ambiente
│   │   ├── database.py              # Conexão PostgreSQL (SQLAlchemy async)
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── user.py              # Model User
│   │   │   ├── job.py               # Model Job
│   │   │   ├── result.py            # Model Result
│   │   │   └── contract.py          # Model Contract
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── job.py
│   │   │   └── result.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py              # Dependências (auth, db)
│   │   │   └── routes/
│   │   │       ├── __init__.py
│   │   │       ├── upload.py        # POST /upload
│   │   │       ├── jobs.py          # GET /jobs/{id}, GET /jobs/{id}/result
│   │   │       ├── drive.py         # POST /extract/drive
│   │   │       └── auth.py          # POST /auth/login, /auth/register
│   │   ├── workers/
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py        # Config Celery
│   │   │   ├── tasks.py             # Task principal process_document
│   │   │   ├── pdf_processor.py     # Compressão + OCR
│   │   │   ├── claude_extractor.py  # Integração Claude API
│   │   │   └── report_generator.py  # Gerador Relatório FATO
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── storage.py           # Cloudflare R2
│   │   │   └── google_drive.py      # Google Drive OAuth2
│   │   └── utils/
│   │       ├── __init__.py
│   │       └── helpers.py
│   ├── alembic/                     # Migrations do banco
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── test_upload.py
│   │   ├── test_processor.py
│   │   └── test_extractor.py
│   ├── .env.example
│   ├── requirements.txt
│   ├── Dockerfile
│   └── Procfile
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx                  # Componente principal já desenvolvido
│   │   ├── api/
│   │   │   └── client.js            # Axios + endpoints
│   │   ├── components/
│   │   │   ├── UploadTab.jsx
│   │   │   ├── FieldsTab.jsx
│   │   │   ├── ResultsTab.jsx
│   │   │   └── ReportTab.jsx
│   │   └── hooks/
│   │       └── useJobPolling.js     # Polling de status do job
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── TASKS.md                         # Este arquivo
└── README.md
```

---

## TASK 2 — Backend: Configuração e Models

### 2.1 — requirements.txt
Crie o arquivo `backend/requirements.txt` com:
```
fastapi==0.115.0
uvicorn[standard]==0.30.0
celery[redis]==5.4.0
redis==5.0.8
sqlalchemy==2.0.35
alembic==1.13.3
asyncpg==0.29.0
pymupdf==1.24.11
Pillow==10.4.0
opencv-python-headless==4.10.0.84
deskew==1.5.1
anthropic==0.36.0
google-api-python-client==2.149.0
google-auth-oauthlib==1.2.1
boto3==1.35.0
python-multipart==0.0.12
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.1
httpx==0.27.0
pytest==8.3.0
pytest-asyncio==0.24.0
```

### 2.2 — .env.example
```env
ANTHROPIC_API_KEY=sk-ant-...
REDIS_URL=redis://localhost:6379/0
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/docextract
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=docextract-pdfs
R2_PUBLIC_URL=https://pub-xxx.r2.dev
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
JWT_SECRET=gere-uma-chave-aleatoria-aqui
JWT_EXPIRE_HOURS=24
FRONTEND_URL=http://localhost:5173
MAX_PDF_PAGES=50
BATCH_SIZE=15
```

### 2.3 — config.py
Implemente usando `pydantic-settings`:
- Lê todas as variáveis do .env
- Valida tipos
- Exporta instância `settings`

### 2.4 — database.py
- Conexão async com PostgreSQL via SQLAlchemy
- `AsyncSession` como dependência FastAPI
- Função `get_db()`

### 2.5 — Models SQLAlchemy

**User:**
- id (UUID, PK)
- email (unique, not null)
- name (varchar)
- hashed_password (varchar)
- plan (varchar, default='starter')
- google_refresh_token (text, nullable, encrypted)
- created_at (timestamp)

**Job:**
- id (UUID, PK)
- user_id (FK → users)
- status (varchar: queued|processing|compressing|extracting|done|error)
- progress (integer, 0-100)
- pdf_key (varchar — chave no R2)
- original_filename (varchar)
- total_pages (integer)
- fields (JSONB)
- contrato (JSONB)
- error_message (text, nullable)
- created_at, completed_at (timestamps)

**Result:**
- id (UUID, PK)
- job_id (FK → jobs, unique)
- funcionarios (JSONB)
- inconsistencias (JSONB)
- report_text (text)
- tipo_documento (varchar)
- empresa (varchar)
- competencia (varchar)
- total_funcionarios (integer)
- created_at (timestamp)

**Contract:**
- id (UUID, PK)
- user_id (FK → users)
- name (varchar)
- client (varchar)
- edital (varchar)
- fields_template (JSONB)
- created_at (timestamp)

---

## TASK 3 — Backend: Pipeline de Processamento (CORE)

### 3.1 — pdf_processor.py

Implemente a função `compress_and_prepare_pdf(pdf_bytes: bytes) -> list[str]`:

```python
"""
OBJETIVO: Receber PDF de qualquer qualidade/tamanho e retornar
lista de imagens base64 JPEG otimizadas para OCR com Claude.

PASSOS:
1. Abrir PDF com PyMuPDF (fitz)
2. Para cada página:
   a. Renderizar em 200 DPI (fitz.Matrix(200/72, 200/72))
   b. Converter para PIL Image RGB
   c. Converter para escala de cinza
   d. Aplicar deskew se inclinação > 0.5 graus (usar biblioteca deskew)
   e. Aumentar contraste com ImageEnhance.Contrast (fator 1.8)
   f. Aumentar nitidez com ImageEnhance.Sharpness (fator 2.0)
   g. Aplicar filtro SHARPEN
   h. Converter de volta para RGB
   i. Salvar como JPEG qualidade 85 em BytesIO
   j. Encode base64
3. Retornar lista de strings base64
4. Limitar ao MAX_PDF_PAGES do settings

TRATAMENTO DE ERROS:
- Se uma página falhar, logar o erro e continuar com as demais
- Nunca deixar uma página com erro travar o processamento inteiro
"""
```

Também implemente `get_pdf_page_count(pdf_bytes: bytes) -> int`

### 3.2 — claude_extractor.py

Implemente `extract_from_pages(pages_b64, fields, contrato) -> dict`:

```python
"""
OBJETIVO: Extrair dados estruturados das páginas usando Claude.

PASSOS:
1. Dividir pages_b64 em lotes de BATCH_SIZE (settings)
2. Para cada lote:
   a. Montar content com imagens + prompt
   b. Chamar claude-sonnet-4-20250514
   c. Parsear JSON da resposta
   d. Acumular funcionarios e inconsistencias
3. Deduplicar funcionários pelo nome (função deduplicate_employees)
4. Retornar resultado consolidado

PROMPT PARA CLAUDE:
Você é um auditor especialista em documentação trabalhista brasileira.
Analise as imagens e extraia dados de TODOS os funcionários.
Campos: {fields_list}
Retorne JSON com: tipo_documento, competencia, empresa,
total_funcionarios, funcionarios[], inconsistencias[], resumo

STATUS POSSÍVEIS:
- "Apresentado" → documento presente
- "Não apresentado" → deveria existir mas está ausente
- "Não consta" → campo inexistente no documento
- "Inconsistente" → divergência nos valores

FUNÇÃO deduplicate_employees:
- Agrupa por nome (case-insensitive, strip)
- Para campos duplicados, mantém o mais completo (não "Não consta")
- Retorna lista deduplicada
"""
```

### 3.3 — report_generator.py

Implemente `generate_fato_report(parsed: dict, contrato: dict, results: list) -> str`:

```python
"""
Gera relatório no formato FATO exato usado pela CESAN.

Estrutura obrigatória:
1. Cabeçalho FATO com número da medição
2. Classificação (Melhorias Requeridas / Eficaz)
3. Evidências (resumo do documento)
4. Inconsistências identificadas (numeradas)
5. Resumo quantitativo (total, pendentes, conformes, %)
6. Base Legal (itens do edital)
7. Risco/Consequência
8. Recomendações
9. Rodapé com fiscal, data e "Gerado pelo DocExtract"
"""
```

### 3.4 — tasks.py (Celery)

Implemente a task `process_document(job_id: str)`:

```python
"""
Task principal. Orquestra todo o pipeline.

FLUXO:
1. Busca job no banco → atualiza status: "processing", progress: 5
2. Baixa PDF do R2 → progress: 10
3. Chama compress_and_prepare_pdf → progress: 15 a 50
   (atualizar progresso a cada página processada)
4. Chama extract_from_pages → progress: 55 a 90
   (atualizar a cada lote processado)
5. Chama generate_fato_report → progress: 95
6. Salva Result no banco → status: "done", progress: 100
7. Atualiza job.completed_at

ERROS:
- Em caso de falha, status: "error", salvar mensagem
- max_retries=3, countdown=30 (retry após 30s)
- Logar todos os erros com contexto (job_id, etapa)
"""
```

---

## TASK 4 — Backend: API Routes

### 4.1 — auth.py
- `POST /auth/register` → cria usuário, retorna JWT
- `POST /auth/login` → valida senha, retorna JWT
- `GET /auth/me` → retorna usuário logado
- Usar passlib para hash de senha
- Usar python-jose para JWT
- Middleware de autenticação em `deps.py`

### 4.2 — upload.py
- `POST /upload` → recebe PDF (multipart/form-data) + fields (JSON) + contrato (JSON)
- Valida que é PDF
- Salva no R2 via storage.py
- Cria Job no banco
- Dispara `process_document.delay(job_id)`
- Retorna `{"job_id": "...", "message": "Processando..."}`

### 4.3 — jobs.py
- `GET /jobs` → lista jobs do usuário (paginado)
- `GET /jobs/{job_id}` → status + progresso do job
  - Retorna: `{status, progress, message, created_at}`
- `GET /jobs/{job_id}/result` → resultado completo
  - Retorna: `{funcionarios[], inconsistencias[], report_text, tipo_documento, empresa, competencia, total_funcionarios}`
- `DELETE /jobs/{job_id}` → deleta job e arquivo do R2

### 4.4 — drive.py
- `GET /auth/google` → inicia OAuth2 flow
- `GET /auth/google/callback` → recebe code, salva refresh_token
- `POST /extract/drive` → recebe file_id do Drive, baixa PDF, mesmo fluxo do upload

### 4.5 — main.py
```python
"""
- Cria app FastAPI com título, versão, docs
- Inclui todos os routers com prefixo /api/v1
- CORS configurado para FRONTEND_URL
- Health check: GET /health → {"status": "ok"}
- Lifespan para inicializar conexões (db, redis)
"""
```

---

## TASK 5 — Storage Service (Cloudflare R2)

### 5.1 — storage.py

```python
"""
Wrapper para Cloudflare R2 (compatível com S3 via boto3).

Implementar:
- upload_file(key: str, data: bytes, content_type: str) -> str (URL)
- download_file(key: str) -> bytes
- delete_file(key: str) -> bool
- generate_presigned_url(key: str, expires: int) -> str

Configuração:
- endpoint_url = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
- Usar boto3 com as credenciais R2
- Prefixo de chave: "pdfs/{job_id}/{filename}"
"""
```

---

## TASK 6 — Frontend: Migrar para Backend

O frontend atual chama a API Anthropic diretamente (inseguro).
Migrar para consumir o backend:

### 6.1 — api/client.js
```javascript
/**
 * Cliente Axios configurado.
 * - Base URL: import.meta.env.VITE_API_URL
 * - Interceptor: adiciona JWT no header Authorization
 * - Interceptor de erro: redireciona para login se 401
 */
```

### 6.2 — hooks/useJobPolling.js
```javascript
/**
 * Hook que faz polling do status de um job a cada 2 segundos.
 * Para quando status === "done" ou "error".
 * Retorna: { status, progress, message, result, error }
 *
 * Usar com React Query ou useEffect + setInterval
 */
```

### 6.3 — Atualizar App.jsx
```javascript
/**
 * Substituir a função extract() atual para:
 * 1. Chamar POST /api/v1/upload com o PDF + campos
 * 2. Receber job_id
 * 3. Iniciar polling com useJobPolling(job_id)
 * 4. Atualizar barra de progresso com dados reais do backend
 * 5. Quando done: buscar GET /api/v1/jobs/{id}/result
 * 6. Preencher tabela e relatório com os dados
 *
 * Adicionar tela de login/registro antes do app principal.
 */
```

---

## TASK 7 — Migrations e Seed

### 7.1 — Alembic
```bash
# Inicializar alembic
alembic init alembic

# Configurar alembic.ini para usar DATABASE_URL do .env

# Criar migration inicial
alembic revision --autogenerate -m "initial"
```

### 7.2 — Seed de desenvolvimento
Criar `backend/seed.py`:
- Cria usuário admin: admin@docextract.com / admin123
- Cria contrato padrão CESAN com campos pré-configurados

---

## TASK 8 — Docker e Deploy

### 8.1 — Dockerfile (backend)
```dockerfile
FROM python:3.12-slim

# Instalar dependências do sistema para PyMuPDF e OpenCV
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    ghostscript \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 8.2 — Procfile (Railway)
```
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT
worker: celery -A app.workers.celery_app worker --loglevel=info --concurrency=2
```

### 8.3 — docker-compose.yml (desenvolvimento local)
```yaml
# Sobe: backend + worker + redis + postgres
# Para rodar: docker-compose up
```

---

## TASK 9 — Testes

### 9.1 — test_processor.py
- Teste com PDF simples (criar PDF de teste com fitz)
- Verificar que retorna lista de base64
- Verificar que não quebra com PDF de 1 página
- Verificar que limita ao MAX_PDF_PAGES

### 9.2 — test_upload.py
- Teste do endpoint POST /upload
- Mock do Celery (não disparar task real)
- Verificar que cria Job no banco
- Verificar que retorna job_id

### 9.3 — test_extractor.py
- Mock da Anthropic API
- Verificar que deduplica funcionários corretamente
- Verificar que processa em lotes corretamente

---

## TASK 10 — README.md

Criar README completo com:
1. O que é o projeto
2. Pré-requisitos
3. Como rodar localmente (docker-compose up)
4. Variáveis de ambiente necessárias
5. Como fazer deploy no Railway + Vercel
6. Arquitetura resumida
7. Como adicionar novos campos de extração

---

## NOTAS IMPORTANTES PARA O CLAUDE CODE

1. **API Key Anthropic**: NUNCA expor no frontend. Sempre server-side.
2. **Processamento assíncrono**: PDFs grandes podem demorar 2-5 minutos. O frontend deve fazer polling, nunca esperar resposta síncrona.
3. **Deduplicação**: Um funcionário pode aparecer em múltiplas páginas. A função deduplicate_employees é crítica.
4. **Lotes**: Claude aceita ~20 imagens por chamada. Sempre processar em batches de 15 para ter margem.
5. **Erros de OCR**: Documentos muito ruins podem retornar dados incompletos. O sistema deve aceitar e sinalizar, nunca travar.
6. **Segurança**: Validar que o job_id pertence ao usuário logado antes de qualquer operação.
7. **Modelo Claude**: Usar `claude-sonnet-4-20250514` para equilíbrio custo/qualidade. Para produção premium, considerar `claude-opus-4-5`.

## ORDEM DE EXECUÇÃO RECOMENDADA

```
Task 1 → Task 2 → Task 3 (CORE) → Task 5 → Task 4 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10
```
