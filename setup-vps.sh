#!/usr/bin/env bash

set -e

REPO="https://github.com/tshoffmam-cyber/docextract.git"
APP_DIR="/opt/docextract"

echo "==> [1/8] Atualizando sistema..."
apt-get update -qq && apt-get upgrade -y -qq

echo "==> [2/8] Instalando dependencias do sistema..."
apt-get install -y -qq git curl wget nginx \
    python3 python3-pip python3-venv python3-dev \
        postgresql postgresql-contrib redis-server \
            build-essential libpq-dev openssl

            echo "==> [3/8] Instalando Node.js e PM2..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y -qq nodejs
            npm install -g pm2 -q

            echo "==> [4/8] Configurando PostgreSQL..."
            systemctl start postgresql && systemctl enable postgresql
            sudo -u postgres psql -c "CREATE USER docextract WITH PASSWORD 'docextract';" 2>/dev/null || true
            sudo -u postgres psql -c "CREATE DATABASE docextract OWNER docextract;" 2>/dev/null || true

            echo "==> [5/8] Configurando Redis..."
            systemctl start redis-server && systemctl enable redis-server

            echo "==> [6/8] Clonando/atualizando repositorio..."
            if [ -d "$APP_DIR" ]; then
                cd "$APP_DIR" && git pull
                else
                    git clone "$REPO" "$APP_DIR"
                    fi

                    echo "==> [7/8] Configurando Python, backend e frontend..."

                    # --- Backend ---
                    cd "$APP_DIR/backend"
                    python3 -m venv .venv
                    source .venv/bin/activate
                    pip install --upgrade pip -q
                    pip install -r requirements.txt -q

                    if [ ! -f .env ]; then
                        JWT_SECRET=$(openssl rand -hex 32)
                            cat > .env << ENVEOF
                            # Chave da API Anthropic (Claude) --- OBRIGATORIO preencher antes de usar
                            ANTHROPIC_API_KEY=

                            # URL de conexao com o Redis
                            REDIS_URL=redis://localhost:6379/0

                            # URL de conexao com o PostgreSQL
                            DATABASE_URL=postgresql+asyncpg://docextract:docextract@localhost:5432/docextract

                            # Cloudflare R2 --- preencher para armazenamento de PDFs
                            R2_ACCOUNT_ID=
                            R2_ACCESS_KEY_ID=
                            R2_SECRET_ACCESS_KEY=
                            R2_BUCKET_NAME=docextract-pdfs
                            R2_PUBLIC_URL=

                            # Segredo JWT gerado automaticamente
                            JWT_SECRET=${JWT_SECRET}

                            # Tempo de expiracao do token JWT em horas
                            JWT_EXPIRE_HOURS=24

                            # URL do frontend (para CORS)
                            FRONTEND_URL=http://31.220.104.90

                            # Limites de processamento de PDF
                            MAX_PDF_PAGES=50
                            BATCH_SIZE=15
                            ENVEOF
                            fi

                            python -m alembic upgrade head
                            python seed.py || true
                            deactivate

                            # --- Frontend ---
                            cd "$APP_DIR/frontend"
                            npm install -q
                            VITE_API_URL=http://31.220.104.90/api/v1 npm run build

                            echo "==> [8/8] Configurando PM2 e Nginx..."

                            cd "$APP_DIR"
                            pm2 delete all 2>/dev/null || true
                            pm2 start ecosystem.config.js
                            pm2 save
                            pm2 startup systemd -u root --hp /root | tail -1 | bash

                            cat > /etc/nginx/sites-available/docextract << 'NGINXEOF'
                            server {
                                listen 80;
                                    server_name 31.220.104.90;

                                        client_max_body_size 50M;

                                            gzip on;
                                                gzip_types text/plain text/css application/javascript application/json;

                                                    location /api/ {
                                                            proxy_pass http://127.0.0.1:8001;
                                                                    proxy_http_version 1.1;
                                                                            proxy_set_header Host $host;
                                                                                    proxy_set_header X-Real-IP $remote_addr;
                                                                                            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                                                                                                    proxy_set_header X-Forwarded-Proto $scheme;
                                                                                                            proxy_read_timeout 300s;
                                                                                                                }
                                                                                                                
                                                                                                                    location /health {
                                                                                                                            proxy_pass http://127.0.0.1:8001;
                                                                                                                                    proxy_http_version 1.1;
                                                                                                                                            proxy_set_header Host $host;
                                                                                                                                                }
                                                                                                                                                
                                                                                                                                                    location /docs {
                                                                                                                                                            proxy_pass http://127.0.0.1:8001;
                                                                                                                                                                    proxy_http_version 1.1;
                                                                                                                                                                            proxy_set_header Host $host;
                                                                                                                                                                                }
                                                                                                                                                                                
                                                                                                                                                                                    location /redoc {
                                                                                                                                                                                            proxy_pass http://127.0.0.1:8001;
                                                                                                                                                                                                    proxy_http_version 1.1;
                                                                                                                                                                                                            proxy_set_header Host $host;
                                                                                                                                                                                                                }
                                                                                                                                                                                                                
                                                                                                                                                                                                                    location /openapi.json {
                                                                                                                                                                                                                            proxy_pass http://127.0.0.1:8001;
                                                                                                                                                                                                                                    proxy_http_version 1.1;
                                                                                                                                                                                                                                            proxy_set_header Host $host;
                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                    location / {
                                                                                                                                                                                                                                                            root /opt/docextract/frontend/dist;
                                                                                                                                                                                                                                                                    index index.html;
                                                                                                                                                                                                                                                                            try_files $uri $uri/ /index.html;
                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                }
                                                                                                                                                                                                                                                                                NGINXEOF
                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                ln -sf /etc/nginx/sites-available/docextract /etc/nginx/sites-enabled/
                                                                                                                                                                                                                                                                                rm -f /etc/nginx/sites-enabled/default
                                                                                                                                                                                                                                                                                nginx -t && systemctl restart nginx && systemctl enable nginx
                                                                                                                                                                                                                                                                                
                                                                                                                                                                                                                                                                                echo ""
                                                                                                                                                                                                                                                                                echo "============================================================"
                                                                                                                                                                                                                                                                                echo " SETUP CONCLUIDO COM SUCESSO!"
                                                                                                                                                                                                                                                                                echo "============================================================"
                                                                                                                                                                                                                                                                                echo ""
                                                                                                                                                                                                                                                                                echo " ATENCAO --- Antes de usar o sistema, preencha obrigatoriamente:"
                                                                                                                                                                                                                                                                                echo ""
                                                                                                                                                                                                                                                                                echo "  1. ANTHROPIC_API_KEY em $APP_DIR/backend/.env"
                                                                                                                                                                                                                                                                                echo "  2. Credenciais R2 (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,"
                                                                                                                                                                                                                                                                                echo "     R2_SECRET_ACCESS_KEY, R2_PUBLIC_URL) em $APP_DIR/backend/.env"
                                                                                                                                                                                                                                                                                echo ""
                                                                                                                                                                                                                                                                                echo "  Edite o arquivo com:"
                                                                                                                                                                                                                                                                                echo "  nano $APP_DIR/backend/.env"
                                                                                                                                                                                                                                                                                echo ""
                                                                                                                                                                                                                                                                                echo "  Depois reinicie o backend com:"
                                                                                                                                                                                                                                                                                echo "  pm2 restart all"
                                                                                                                                                                                                                                                                                echo "============================================================"
