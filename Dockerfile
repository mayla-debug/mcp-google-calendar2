FROM node:22-slim

WORKDIR /app

# Copia solo i manifest per sfruttare la cache
COPY package*.json ./

# Installa dipendenze (usa ci se c'è il lockfile, altrimenti install)
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copia il resto dei sorgenti
COPY . .

# Build TypeScript
RUN npm run build

# Avvio del tuo MCP server (senza passare dal bundler di Smithery)
CMD ["node", "build/index.js"]
