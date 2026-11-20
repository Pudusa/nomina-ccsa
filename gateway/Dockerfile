# Stage 1: Build Frontend
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Nginx Gateway & Static Server
FROM nginx:alpine
COPY gateway/nginx.conf /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 4000
CMD ["nginx", "-g", "daemon off;"]
