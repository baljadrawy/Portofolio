# syntax=docker/dockerfile:1

# ── deps ────────────────────────────────────────────────────────────
# Full install (incl. devDependencies) — needed to build.
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# vite → dist/public (client) · esbuild → dist/index.js (server)
RUN npm run build

# ── prod deps ───────────────────────────────────────────────────────
# Separate stage so runtime carries no devDependencies.
FROM node:20-alpine AS proddeps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# wget is used by the container healthcheck.
RUN apk add --no-cache wget

COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=build    /app/dist          ./dist
COPY package.json ./

# node:alpine ships an unprivileged `node` user (uid 1000).
USER node

EXPOSE 3000

# 127.0.0.1 not localhost: localhost resolves to ::1 first and the app
# listens on IPv4. Matches the pattern already used by baity-app.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Runs the production artifact produced by `npm run build`.
CMD ["node", "dist/index.js"]
