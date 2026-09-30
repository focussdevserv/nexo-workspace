FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY api/package*.json ./
RUN npm ci
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node public/nexo-build.json ./build-info.json
COPY --chown=node:node api/drizzle ./drizzle
USER node
EXPOSE 3001
CMD ["node", "dist/server.js"]
