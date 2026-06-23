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
    && rm -rf node_modules \
    && npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# Strip runtime-useless bloat from production node_modules
RUN find node_modules -type f \( \
      -name "*.ts" -o -name "*.map" -o -name "*.md" \
      -o -name "*.tsx" -o -name "*.jsx" \
      -o -name "*.yml" -o -name "*.yaml" \
      -o -name "*.editorconfig" -o -name ".npmignore" \
      -o -name "LICENSE" -o -name "LICENSE-MIT" -o -name "LICENSE.txt" \
      -o -name "CHANGELOG.md" -o -name "CHANGES.md" -o -name "HISTORY.md" \
    \) -delete 2>/dev/null; \
    find node_modules -type d \( \
      -name "test" -o -name "tests" -o -name "__tests__" \
      -o -name "doc" -o -name "docs" -o -name "example" -o -name "examples" \
      -o -name ".github" -o -name "benchmark" -o -name "benchmarks" \
    \) -exec rm -rf {} + 2>/dev/null; \
    rm -rf node_modules/@types 2>/dev/null; \
    rm -rf node_modules/yargs 2>/dev/null

FROM alpine:3.24 AS runtime
RUN apk add --no-cache nodejs
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node
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
# 生产直接用 node 跑编译产物 dist/*.js,无需 tsx(已实测与 tsx 版功能等价,镜像 96.8→84.8MB)
CMD ["node", "dist/index.js"]
