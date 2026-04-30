"use strict";

const { spawn, spawnSync } = require("child_process");
const path = require("path");
const http = require("http");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT = process.env.PORT || 3000;
const BACKEND_PORT = 8001;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const BACKEND_DIR = path.join(__dirname, "backend");
const DIST_DIR = path.join(__dirname, "frontend", "dist");

// ── helpers ──────────────────────────────────────────────────────────────────

function log(tag, data) {
  String(data)
    .split("\n")
    .filter(Boolean)
    .forEach((line) => console.log(`[${tag}] ${line}`));
}

function startProcess(cmd, args, opts, tag) {
  const proc = spawn(cmd, args, { ...opts, stdio: "pipe" });
  proc.stdout.on("data", (d) => log(tag, d));
  proc.stderr.on("data", (d) => log(tag, d));
  proc.on("exit", (code) =>
    console.log(`[${tag}] processo encerrado — código ${code}`)
  );
  return proc;
}

// ── setup síncrono (pip + migrations) ────────────────────────────────────────

console.log("[setup] Instalando dependências Python...");
const pip = spawnSync(
  "pip",
  ["install", "--no-cache-dir", "-r", "backend/requirements.txt"],
  { stdio: "inherit", cwd: __dirname }
);
if (pip.status !== 0) {
  console.error("[setup] pip install falhou — abortando");
  process.exit(1);
}

console.log("[setup] Rodando migrations Alembic...");
const alembic = spawnSync(
  "python",
  ["-m", "alembic", "upgrade", "head"],
  { stdio: "inherit", cwd: BACKEND_DIR }
);
if (alembic.status !== 0) {
  console.error("[setup] alembic upgrade head falhou — abortando");
  process.exit(1);
}

// ── processos filhos de longa duração ────────────────────────────────────────

const uvicorn = startProcess(
  "uvicorn",
  ["app.main:app", "--host", "127.0.0.1", "--port", String(BACKEND_PORT)],
  { cwd: BACKEND_DIR },
  "uvicorn"
);

const celery = startProcess(
  "celery",
  ["-A", "app.workers.celery_app", "worker", "--loglevel=info", "--concurrency=1"],
  { cwd: BACKEND_DIR },
  "celery"
);

// ── graceful shutdown ─────────────────────────────────────────────────────────

function shutdown(signal) {
  console.log(`\n[server] ${signal} recebido — encerrando processos...`);
  uvicorn.kill("SIGTERM");
  celery.kill("SIGTERM");
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// ── aguarda o backend subir ───────────────────────────────────────────────────

function waitForBackend(retries = 60, interval = 2000) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const check = () => {
      const req = http.get(`${BACKEND_URL}/health`, (res) => {
        if (res.statusCode === 200) {
          console.log("[server] Backend pronto — iniciando servidor HTTP");
          resolve();
        } else {
          retry();
        }
      });
      req.on("error", retry);
      req.setTimeout(1500, () => { req.destroy(); retry(); });
    };
    const retry = () => {
      attempts++;
      if (attempts >= retries) {
        reject(new Error(`Backend não respondeu após ${retries} tentativas`));
        return;
      }
      console.log(`[server] Aguardando backend... (${attempts}/${retries})`);
      setTimeout(check, interval);
    };
    check();
  });
}

// ── Express ───────────────────────────────────────────────────────────────────

waitForBackend()
  .then(() => {
    const app = express();

    // proxy para /api/v1/* e /health
    const proxy = createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      on: {
        error: (err, req, res) => {
          console.error("[proxy] erro:", err.message);
          res.status(502).json({ error: "Backend indisponível" });
        },
      },
    });

    app.use("/api", proxy);
    app.use("/health", proxy);
    app.use("/docs", proxy);
    app.use("/redoc", proxy);

    // arquivos estáticos do frontend buildado
    app.use(express.static(DIST_DIR));

    // SPA fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(DIST_DIR, "index.html"));
    });

    app.listen(PORT, () => {
      console.log(`[server] Ouvindo na porta ${PORT}`);
      console.log(`[server] Frontend: http://0.0.0.0:${PORT}`);
      console.log(`[server] API proxy: ${BACKEND_URL}`);
    });
  })
  .catch((err) => {
    console.error("[server] FATAL:", err.message);
    uvicorn.kill("SIGTERM");
    celery.kill("SIGTERM");
    process.exit(1);
  });
