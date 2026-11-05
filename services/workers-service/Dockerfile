FROM node:24-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci && npm rebuild better-sqlite3

WORKDIR /app/services/workers-service
COPY services/workers-service/package.json ./
RUN npm install && npm rebuild better-sqlite3

FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/workers-service/node_modules ./services/workers-service/node_modules
COPY services/workers-service ./services/workers-service

WORKDIR /app/services/workers-service

ENV PORT=3002
EXPOSE 3002

CMD ["node", "server.cjs"]
