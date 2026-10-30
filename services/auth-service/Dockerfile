FROM node:20-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copy root and service package files
COPY package.json package-lock.json ./
COPY services/auth-service/package.json services/auth-service/package-lock.json ./services/auth-service/

# Install root dependencies and rebuild native modules
RUN npm ci && npm rebuild better-sqlite3

# Install auth-service dependencies
WORKDIR /app/services/auth-service
RUN npm ci && npm rebuild better-sqlite3

FROM node:20-slim

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

# Copy node_modules and code
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/auth-service/node_modules ./services/auth-service/node_modules
COPY services/auth-service ./services/auth-service
COPY server ./server

WORKDIR /app/services/auth-service

ENV AUTH_PORT=3001
EXPOSE 3001

CMD ["node", "server.cjs"]
