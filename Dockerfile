# syntax=docker/dockerfile:1

FROM node:24-alpine AS web-build
WORKDIR /build/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
ARG VITE_AMAP_KEY
ARG VITE_AMAP_SECURITY_JS_CODE
ENV VITE_AMAP_KEY=${VITE_AMAP_KEY} \
    VITE_AMAP_SECURITY_JS_CODE=${VITE_AMAP_SECURITY_JS_CODE}
RUN npm run build

FROM node:24-alpine AS server-build
WORKDIR /build/server
COPY server/package*.json ./
RUN npm ci
COPY server/tsconfig.json ./
COPY server/src/ ./src/
RUN npx tsc \
    && cp -r src/proto dist/proto \
    && npm prune --omit=dev

FROM node:24-alpine AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/app/data
WORKDIR /app/server
RUN mkdir -p /app/data && chown node:node /app/data
COPY --from=server-build --chown=node:node /build/server/package*.json ./
COPY --from=server-build --chown=node:node /build/server/node_modules ./node_modules
COPY --from=server-build --chown=node:node /build/server/dist ./dist
COPY --from=web-build --chown=node:node /build/web/dist /app/web/dist
USER node
EXPOSE 8787
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
