# DocExtract

Sistema de auditoria inteligente de contratos públicos (CESAN/ES).
Automatiza a extração de dados de PDFs trabalhistas — holerites, FGTS, VT, ponto, ASO — e gera relatórios de auditoria no formato FATO.

---

## O que é o projeto

O DocExtract recebe PDFs de documentação trabalhista, processa cada página com OCR assistido por IA (Claude) e produz:

- Tabela de funcionários com status por campo (Apresentado / Não apresentado / Inconsistente)
- Lista de inconsistências identificadas
- Relatório FATO pronto para uso pelo fiscal do contrato

O processamento é 100% assíncrono via Celery. O frontend faz polling do status a cada 2 segundos sem bloquear o usuário.

---

## Pré-requisitos

| Ferramenta | Versão mínima |
|---|---|
| Docker + Docker Compose | 24+ |
| Python | 3.12+ (sem Docker) |
| Node.js | 18+ (frontend sem Docker) |
| Conta Anthropic | API Key ativa |
| Cloudflare R2 | Bucket criado |

---

## Como rodar localmente

### 1. Clone e configure o ambiente

```bash
git clone https://github.com/tshoffmam-cyber/docextract.git
cd docextract
cp backend/.env.example backend/.env
```

Edite `backend/.env` com suas credenciais reais (veja seção abaixo).

### 2. Suba tudo com Docker Compose

```bash
docker-compose up --build
```

Isso sobe 4 serviços:
- `postgres` — banco de dados na porta 5432
- `redis` — broker Celery na porta 6379
- `backend` — API FastAPI com hot-reload na porta 8000
- `worker` — Celery worker processando jobs em background

### 3. Rode as migrations e o seed

```bash
docker-compose exec backend alembic upgrade head
docker-compose exec backend python seed.py
```

Acesso padrão após o seed:
- **E-mail:** `admin@docextract.com`
- **Senha:** `admin123`

### 4. Acesse

- API: http://localhost:8000
- Docs interativos: http://localhost:8000/docs
- Frontend (dev): veja seção Frontend abaixo

---

## Frontend (desenvolvimento)

```bash
cd frontend
npm install
cp .env.example .env.local   # crie com VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

Acesse em http://localhost:5173

---

## Variáveis de ambiente

Todas as variáveis ficam em `backend/.env`. Copie de `.env.example`:

| Variável | Descrição | Obrigatória |
|---|---|---|
| `ANTHROPIC_API_KEY` | Chave da API Anthropic | Sim |
| `DATABASE_URL` | URL PostgreSQL async (`postgresql+asyncpg://...`) | Sim |
| `REDIS_URL` | URL Redis (`redis://...`) | Sim |
| `R2_ACCOUNT_ID` | ID da conta Cloudflare | Sim |
| `R2_ACCESS_KEY_ID` | Access key do bucket R2 | Sim |
| `R2_SECRET_ACCESS_KEY` | Secret key do bucket R2 | Sim |
| `R2_BUCKET_NAME` | Nome do bucket (default: `docextract-pdfs`) | Sim |
| `R2_PUBLIC_URL` | URL pública do bucket | Sim |
| `JWT_SECRET` | Chave secreta JWT (gere com `openssl rand -hex 32`) | Sim |
| `JWT_EXPIRE_HOURS` | Expiração do token em horas (default: `24`) | Não |
| `FRONTEND_URL` | URL do frontend para CORS (default: `http://localhost:5173`) | Não |
| `GOOGLE_CLIENT_ID` | OAuth2 Google (opcional, para integração Drive) | Não |
| `GOOGLE_CLIENT_SECRET` | OAuth2 Google | Não |
| `MAX_PDF_PAGES` | Limite de páginas por PDF (default: `50`) | Não |
| `BATCH_SIZE` | Imagens por chamada ao Claude (default: `15`) | Não |

---

## Deploy no Railway + Vercel

### Backend — Railway

1. Crie um novo projeto no [Railway](https://railway.app)
2. Adicione um serviço **PostgreSQL** e um **Redis** no projeto
3. Conecte o repositório GitHub e aponte o root para `/backend`
4. O Railway detecta o `Procfile` automaticamente e sobe `web` e `worker`
5. Configure todas as variáveis de ambiente no painel do Railway
6. Após o primeiro deploy, rode as migrations via Railway CLI:

```bash
railway run alembic upgrade head
railway run python seed.py
```

### Frontend — Vercel

1. Importe o repositório no [Vercel](https://vercel.com)
2. Configure o **Root Directory** como `frontend`
3. Adicione a variável de ambiente:
   - `VITE_API_URL` → URL pública do backend Railway (ex: `https://docextract-api.up.railway.app/api/v1`)
4. Deploy automático a cada push na `main`

---

## Arquitetura

```
┌─────────────┐     POST /upload      ┌──────────────────┐
│   Frontend  │ ──────────────────── ▶│   FastAPI (web)  │
│  React/Vite │                       │   Railway        │
│   Vercel    │ ◀──────────────────── │                  │
└─────────────┘   polling /jobs/{id}  └────────┬─────────┘
                                               │ task.delay()
                                               ▼
                                      ┌──────────────────┐
                                      │  Redis (broker)  │
                                      └────────┬─────────┘
                                               │
                                               ▼
                                      ┌──────────────────┐
                                      │  Celery Worker   │
                                      │                  │
                                      │ 1. Download R2   │
                                      │ 2. compress PDF  │
                                      │ 3. Claude API    │
                                      │ 4. Gera FATO     │
                                      │ 5. Salva Result  │
                                      └────────┬─────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              ▼                                  ▼
                     ┌──────────────┐                  ┌──────────────────┐
                     │  PostgreSQL  │                  │  Cloudflare R2   │
                     │  (jobs,      │                  │  (PDFs originais)│
                     │   results)   │                  └──────────────────┘
                     └──────────────┘
```

**Fluxo de processamento:**
1. Frontend envia PDF + campos + contrato via `POST /api/v1/upload`
2. Backend salva o PDF no R2 e cria um `Job` com status `queued`
3. Task Celery processa: comprime páginas (200 DPI → JPEG), chama Claude em lotes de 15 imagens, deduplica funcionários, gera relatório FATO
4. Frontend faz polling em `GET /api/v1/jobs/{id}` a cada 2s até `status=done`
5. Frontend busca `GET /api/v1/jobs/{id}/result` e exibe a tabela e o relatório

---

## Como adicionar novos campos de extração

Os campos extraídos são dinâmicos — não há hardcode no backend.

### Via contrato (recomendado)

Ao fazer upload, envie o JSON de `fields` com os campos desejados:

```json
{
  "Holerite": "",
  "FGTS": "",
  "Vale Transporte": "",
  "ASO": "",
  "Férias": ""
}
```

O Claude tentará extrair todos esses campos de cada funcionário encontrado no PDF.

### Via template de contrato (persistente)

Crie um `Contract` com `fields_template` no banco via seed ou API futura.
O frontend pode reutilizar o template a cada upload sem redigitar os campos.

### Adicionar campo com lógica especial

Para campos com regras de validação específicas (ex: "FGTS deve bater com o salário base"), edite o prompt em `claude_extractor.py:_build_prompt()` adicionando a regra no bloco de instruções enviado ao Claude.

---

## Testes

```bash
cd backend
pip install -r requirements.txt
pytest tests/ -v
```
<!-- deploy: trigger vercel production from main -->

Os testes não precisam de banco nem de credenciais reais — toda I/O externa é mockada.

---

## Licença

Uso interno CESAN/ES. Todos os direitos reservados.
