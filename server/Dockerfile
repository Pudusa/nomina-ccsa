FROM node:20-slim AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native module on Debian
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy package definition files and source code for frontend build
COPY package.json package-lock.json tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html ./
COPY src ./src
COPY public ./public

# Install all dependencies and rebuild native better-sqlite3 module
RUN npm ci && npm rebuild better-sqlite3

# Build frontend bundle
RUN npm run build

FROM node:20-slim

WORKDIR /app

# Install sqlite runtime libraries
RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy production node_modules, built frontend (dist), and server source
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./package.json
COPY server ./server

ENV PORT=4000
EXPOSE 4000

CMD ["node", "server/index.cjs"]
