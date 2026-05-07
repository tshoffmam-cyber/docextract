#!/usr/bin/env bash
set -e

# DocExtract - Setup VPS Hostinger (Ubuntu 24.04)
# Uso: bash setup-vps.sh
# Execute apenas uma vez no VPS limpo

REPO="https://github.com/tshoffmam-cyber/docextract.git"
APP_DIR="/opt/docextract"

echo "==> [1/7] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

echo "==> [2/7] Instalando dependencias..."
apt-get install -y -qq git curl wget nginx \
  python3 python3-pip python3-venv python3-dev \
    postgresql postgresql-contrib redis-server \
      build-essential libpq-dev openssl

      echo "==> [3/7] Configurando PostgreSQL..."
      systemctl start postgresql && systemctl enable postgresql
      sudo -u postgres psql -c "CREATE USER docextract WITH PASSWORD 'docextract';" 2>/dev/null || true
      sudo -u postgres psql -c "CREATE DATABASE docextract OWNER docextract;" 2>/dev/null || true

      echo "==> [4/7] Configurando Redis..."
      systemctl start redis-server && systemctl enable redis-server

      echo "==> [5/7] Clonando repositorio..."
      if [ -d "$APP_DIR" ]; then
        cd "$APP_DIR" && git pull
        else
          git clone "$REPO" "$APP_DIR"
          fi
          cd "$APP_DIR/backend"

          echo "==> [6/7] Configurando Python e backend..."
          python3 -m venv .venv
          source .venv/bin/activate
          pip install --upgrade pip -q
          pip install -r requirements.txt -q

          if [ ! -f .env ]; then
            JWT_SECRET=$(openssl rand -hex 32)
              cat > .env << ENVEOF
              GEMINI_API_KEY=AIzaSyDLDmkMr8KsB8fGSuIVUecL0Fxan2BHI4s
              ANTHROPIC_API_KEY=
              REDIS_URL=redis://localhost:6379/0
              DATABASE_URL=postgresql+asyncpg://docextract:docextract@localhost:5432/docextract
              R2_ACCOUNT_ID=
              R2_ACCESS_KEY_ID=
              R2_SECRET_ACCESS_KEY=
              R2_BUCKET_NAME=docextract-pdfs
              R2_PUBLIC_URL=
              JWT_SECRET=${JWT_SECRET}
              JWT_EXPIRE_HOURS=24
              FRONTEND_URL=https://docextract-nine.vercel.app
              MAX_PDF_PAGES=50
              BATCH_SIZE=15
              ENVEOF
              fi

              python -m alembic upgrade head
              python seed.py || true
              deactivate

              echo "==> [7/7] Instalando PM2 e configurando Nginx..."
              curl -fsSL https://deb.nodesource.com/setup_20.x | bash - -q
              apt-get install -y -qq nodejs
              npm install -g pm2 -q

              cd "$APP_DIR"
              pm2 delete all 2>/dev/null || true
              pm2 start ecosystem.config.js
              pm2 save
              pm2 startup systemd -u root --hp /root | tail -1 | bash

              cat > /etc/nginx/sites-available/docextract << 'NGINXEOF'
              server {
                  listen 80;
                      server_name _;
                          client_max_body_size 50M;
                              gzip on;
                                  gzip_types text/plain text/css application/javascript application/json;
                                      location /api/ {
                                              proxy_pass http://127.0.0.1:8001;
                                                      proxy_http_version 1.1;
                                                              proxy_set_header Host $host;
                                                                      proxy_set_header X-Real-IP $remote_addr;
                                                                              proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                                                                                      proxy_read_timeout 120s;
                                                                                          }
                                                                                              location / {
                                                                                                      proxy_pass http://127.0.0.1:8001;
                                                                                                          }
                                                                                                          }
                                                                                                          NGINXEOF
                                                                                                          
                                                                                                          ln -sf /etc/nginx/sites-available/docextract /etc/nginx/sites-enabled/
                                                                                                          rm -f /etc/nginx/sites-enabled/default
                                                                                                          nginx -t && systemctl restart nginx && systemctl enable nginx
                                                                                                          
                                                                                                          echo ""
                                                                                                          echo "======================================"
                                                                                                          echo "  Deploy concluido com sucesso!"
                                                                                                          echo "======================================"
                                                                                                          echo "API: http://31.220.104.90/api/v1"
                                                                                                          echo "Docs: http://31.220.104.90/docs"
                                                                                                          echo "Login: admin@docextract.com / admin123"
                                                                                                          echo ""
                                                                                                          echo "pm2 status     - ver processos"
                                                                                                          echo "pm2 logs       - ver logs"
