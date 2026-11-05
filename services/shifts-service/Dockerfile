FROM node:24-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci && npm rebuild better-sqlite3

WORKDIR /app/services/shifts-service
COPY services/shifts-service/package.json ./
RUN npm install && npm rebuild better-sqlite3

FROM node:24-slim

WORKDIR /app

RUN apt-get update && apt-get install -y sqlite3 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/services/shifts-service/node_modules ./services/shifts-service/node_modules
COPY services/shifts-service ./services/shifts-service

WORKDIR /app/services/shifts-service

ENV PORT=3004
EXPOSE 3004

CMD ["node", "server.cjs"]
