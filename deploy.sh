#!/usr/bin/env bash
set -e

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$APP_DIR"

echo "==> [1/6] Instalando dependências Node.js..."
npm install

echo "==> [2/6] Instalando dependências Python..."
pip install --no-cache-dir -r backend/requirements.txt

echo "==> [3/6] Buildando frontend..."
npm run build

echo "==> [4/6] Rodando migrations Alembic..."
cd backend && python -m alembic upgrade head && cd ..

echo "==> [5/6] Iniciando processos com PM2..."
pm2 start ecosystem.config.js

echo "==> [6/6] Salvando configuração PM2 para reinício automático..."
pm2 save

echo ""
echo "✓ Deploy concluído!"
echo ""
echo "Comandos úteis:"
echo "  pm2 status              — estado dos processos"
echo "  pm2 logs                — logs em tempo real"
echo "  pm2 restart all         — reiniciar tudo"
echo "  pm2 stop all            — parar tudo"
echo ""
echo "Nginx — copie o nginx.conf para o servidor:"
echo "  sudo cp nginx.conf /etc/nginx/sites-available/docextract"
echo "  sudo ln -sf /etc/nginx/sites-available/docextract /etc/nginx/sites-enabled/"
echo "  sudo nginx -t && sudo systemctl reload nginx"
echo ""
echo "Para startup automático no boot:"
echo "  pm2 startup             — gera o comando, execute-o com sudo"
echo "  pm2 save"
