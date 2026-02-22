#!/bin/bash

# BeautyBook - Script de Inicialização
# Inicia o servidor Backend e Frontend simultaneamente

echo "🚀 Iniciando BeautyBook..."
echo ""

# Inicia o backend em background
echo "📦 Iniciando servidor Backend (API)..."
cd server && node index.js &
BACKEND_PID=$!

# Volta para a pasta principal e inicia o frontend
# cd .. (Removed: previous command runs in subshell)
echo "🎨 Iniciando servidor Frontend (Vite)..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ Servidores iniciados!"
echo "   Backend:  http://localhost:3002"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Pressione Ctrl+C para parar os dois servidores."

# Trap para matar os dois processos quando o script for interrompido
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo ''; echo '👋 Servidores finalizados.'; exit" SIGINT SIGTERM

# Mantém o script rodando
wait
