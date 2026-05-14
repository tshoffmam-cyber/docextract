module.exports = {
    apps: [

      // ── FastAPI Backend (uvicorn) ─────────────────────────────────────────────
      {
              name: "docextract-api",
              script: "/opt/docextract/backend/.venv/bin/python",
              args: "-m uvicorn app.main:app --host 127.0.0.1 --port 8001 --workers 2",
              cwd: "/opt/docextract/backend",
              interpreter: "none",
              autorestart: true,
              watch: false,
              max_restarts: 10,
              restart_delay: 5000,
              max_memory_restart: "512M",
              env: {
                        PYTHONUNBUFFERED: "1",
                        PYTHONDONTWRITEBYTECODE: "1",
              },
              env_file: "/opt/docextract/backend/.env",
      },

          // ── Celery Worker ─────────────────────────────────────────────────────────
      {
              name: "docextract-worker",
              script: "/opt/docextract/backend/.venv/bin/python",
              args: "-m celery -A app.workers.celery_app worker --loglevel=info --concurrency=2",
              cwd: "/opt/docextract/backend",
              interpreter: "none",
              autorestart: true,
              watch: false,
              max_restarts: 10,
              restart_delay: 5000,
              max_memory_restart: "512M",
              env: {
                        PYTHONUNBUFFERED: "1",
                        PYTHONDONTWRITEBYTECODE: "1",
              },
              env_file: "/opt/docextract/backend/.env",
      },

        ],
};
