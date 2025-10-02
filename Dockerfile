# ===== Stage 1: build =====
FROM node:20-bullseye-slim AS builder
WORKDIR /app

# Copia solo i file necessari per l’install
COPY package.json package-lock.json ./
# Install di TUTTE le dipendenze (incluse dev) per poter buildare
RUN npm ci

# Copia sorgenti e config TS
COPY tsconfig.json ./tsconfig.json
COPY src ./src

# Build TS -> JS
RUN npm run build

# ===== Stage 2: runtime =====
FROM node:20-bullseye-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NODE_OPTIONS=--enable-source-maps

# Copia manifest e lock e installa SOLO dipendenze prod
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copia artefatti buildati dallo stage precedente
COPY --from=builder /app/build ./build
# (Se ti serve in immagine:) COPY smithery.yaml ./smithery.yaml

# Avvio del server MCP
CMD ["node", "build/index.js"]
