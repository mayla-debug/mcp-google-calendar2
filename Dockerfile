FROM node:22-slim

WORKDIR /app

# Installa dipendenze (usa il lock se c'è)
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copia il resto del progetto
COPY . .

# Compila TypeScript (se usi build/ localmente)
RUN npm run build || true

# 🔹 Build Smithery in formato ESM (non CJS)
RUN npx -y @smithery/cli@1.4.4 build -o .smithery/index.mjs

# Avvio in ESM
CMD ["node", ".smithery/index.mjs"]
