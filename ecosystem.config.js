module.exports = {
  apps: [
    // ── Python API (uvicorn) ──────────────────────────────────────────────────
    {
      name: "docextract-api",
      script: "uvicorn",
      args: "app.main:app --host 127.0.0.1 --port 8001 --workers 2",
      cwd: "./backend",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },

    // ── Celery worker ─────────────────────────────────────────────────────────
    {
      name: "docextract-worker",
      script: "celery",
      args: "-A app.workers.celery_app worker --loglevel=info --concurrency=2",
      cwd: "./backend",
      interpreter: "none",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",
      env: {
        PYTHONUNBUFFERED: "1",
      },
    },

    // ── Node.js (proxy reverso + frontend estático) ───────────────────────────
    {
      name: "docextract-web",
      script: "server.js",
      cwd: ".",
      interpreter: "node",
      autorestart: true,
      watch: false,
      max_memory_restart: "256M",
      env: {
        PORT: 3000,
        BACKEND_PORT: 8001,
        NODE_ENV: "production",
      },
    },
  ],
};
