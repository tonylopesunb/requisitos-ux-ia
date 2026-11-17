FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/servidor/package.json apps/servidor/
RUN pnpm install --frozen-lockfile --filter servidor...
COPY apps/servidor apps/servidor
RUN pnpm --filter servidor build && pnpm deploy --filter servidor --prod --legacy /out

FROM node:22-alpine
WORKDIR /app
COPY --from=build /out ./
COPY apps/servidor/drizzle ./drizzle
COPY dados-ficticios /dados-ficticios
ENV NODE_ENV=production
EXPOSE 3000
# Aplica as migrações e sobe o servidor. Para carregar a demonstração: docker compose exec servidor node dist/banco/semear.js
CMD ["sh", "-c", "node dist/banco/migrar.js && node dist/main.js"]
