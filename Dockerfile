# syntax=docker/dockerfile:1

# ---- Build stage ----
FROM node:26-alpine AS build
WORKDIR /app

# Install dependencies with workspace manifests only (better layer caching)
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY apps/prototype/package.json apps/prototype/
RUN npm ci --workspace=apps/web --include-workspace-root=false

COPY apps/web apps/web
RUN npm --workspace=apps/web run build

# ---- Runtime stage ----
# Non-root nginx image; listens on 8080 (Cloud Run default PORT)
FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 8080
