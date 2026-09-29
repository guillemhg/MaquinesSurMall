#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js no esta instalado. Instala Node.js LTS y vuelve a ejecutar este archivo."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Primera ejecucion: instalando dependencias..."
  npm install
fi

echo "MaquinesSurMall disponible en http://localhost:5173"
npm run dev -- --host 127.0.0.1
