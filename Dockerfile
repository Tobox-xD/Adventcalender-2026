# Stage 1: Build
FROM node:22-alpine AS build-stage
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM caddy:2-alpine AS production-stage
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build-stage /app/dist /srv

EXPOSE 80
