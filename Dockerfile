FROM node:22-slim

WORKDIR /app

# Solo i manifest per installare più in fretta
COPY package.json package-lock.json* ./

# Installa prod+dev: ci serve tsc e la CLI durante il build
RUN npm ci

# Copia il resto
COPY . .

# 1) compila TypeScript -> ./build
RUN npm run build

# 2) genera il bundle per Smithery (HTTP/sHTTP, quello giusto per l’hosting)
#    usiamo una versione della CLI allineata
RUN npx -y @smithery/cli@1.4.2 build -o .smithery/index.cjs

# Smithery avvia il container aspettandosi un server HTTP.
# Il bundle creato sopra espone l’endpoint MCP corretto.
CMD ["node", ".smithery/index.cjs"]
