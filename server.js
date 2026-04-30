"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const PORT        = process.env.PORT        || 3000;
const BACKEND_PORT = process.env.BACKEND_PORT || 8001;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const DIST_DIR    = path.join(__dirname, "frontend", "dist");

// ── aguarda uvicorn subir ─────────────────────────────────────────────────────

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

// ── graceful shutdown ─────────────────────────────────────────────────────────

process.on("SIGTERM", () => { console.log("[server] SIGTERM — encerrando"); process.exit(0); });
process.on("SIGINT",  () => { console.log("[server] SIGINT — encerrando");  process.exit(0); });

// ── Express ───────────────────────────────────────────────────────────────────

waitForBackend()
  .then(() => {
    const app = express();

    const proxy = createProxyMiddleware({
      target: BACKEND_URL,
      changeOrigin: true,
      on: {
        error: (err, _req, res) => {
          console.error("[proxy] erro:", err.message);
          res.status(502).json({ error: "Backend indisponível" });
        },
      },
    });

    app.use("/api",    proxy);
    app.use("/health", proxy);
    app.use("/docs",   proxy);
    app.use("/redoc",  proxy);

    app.use(express.static(DIST_DIR));

    app.get("*", (_req, res) =>
      res.sendFile(path.join(DIST_DIR, "index.html"))
    );

    app.listen(PORT, () => {
      console.log(`[server] Porta ${PORT} — proxy → uvicorn:${BACKEND_PORT}`);
    });
  })
  .catch((err) => {
    console.error("[server] FATAL:", err.message);
    process.exit(1);
  });
