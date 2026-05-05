#!/bin/bash

# Zakys App - Script de Inicialização
# Inicia o servidor Backend e Frontend simultaneamente usando npm

echo "🚀 Iniciando Zakys App..."
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ] || [ ! -d "server/node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    cd server && npm install
    cd ..
fi

echo "🎨 Iniciando servidores (Frontend + Backend)..."
npm run dev

# O script npm run dev com concurrently já gerencia os processos e o encerramento
echo ""
echo "👋 Servidores finalizados."
