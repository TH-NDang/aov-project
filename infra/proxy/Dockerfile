# syntax=docker/dockerfile:1
# The reverse proxy image: static builds of the three frontend apps served by Caddy (spec 01, section 3.4).
# Build context is frontend/; Compose passes the other inputs as named contexts `proxy` and `skill-artwork`.

FROM node:22-bookworm-slim AS frontend
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /workspace/frontend
COPY . .
# The Wiki build bundles these public illustrations from resources/ (apps/aov-wiki/skill-artwork.mts).
COPY --from=skill-artwork . /workspace/resources/Lien-Quan-v3/assets/skill/
RUN if grep --recursive --files-with-matches --max-count=1 "git-lfs.github.com/spec" \
        /workspace/resources/Lien-Quan-v3/assets/skill | grep --quiet .; then \
        echo 'resources/Lien-Quan-v3/assets/skill holds Git LFS pointers, not images.' >&2; \
        echo 'Run: git lfs pull --include="resources/Lien-Quan-v3/assets/skill/*"' >&2; \
        exit 1; \
    fi
RUN --mount=type=cache,id=aov-pnpm-store,target=/pnpm-store \
    pnpm install --frozen-lockfile --store-dir /pnpm-store

# Frontend configuration is compiled in, so changing the origin needs a rebuild.
ARG VITE_AUTH_ISSUER
ARG VITE_WIKI_URL
ARG VITE_STREAM_URL
ARG VITE_ADMIN_URL
ENV VITE_AUTH_ISSUER=$VITE_AUTH_ISSUER \
    VITE_WIKI_URL=$VITE_WIKI_URL \
    VITE_STREAM_URL=$VITE_STREAM_URL \
    VITE_ADMIN_URL=$VITE_ADMIN_URL
RUN pnpm --filter @aov/aov-wiki run build
RUN pnpm --filter @aov/aov-stream run build --base=/stream/
RUN pnpm --filter @aov/admin-aov run build --base=/admin/

# One-shot job of Compose (service wiki-prerender): the API does not exist yet while images build (ADR-022).
FROM node:22-bookworm-slim AS wiki-prerender
WORKDIR /job
COPY --from=frontend /workspace/frontend/apps/aov-wiki/package.json ./
COPY --from=frontend /workspace/frontend/apps/aov-wiki/dist ./dist
COPY --from=frontend /workspace/frontend/apps/aov-wiki/scripts ./scripts
COPY --from=frontend /workspace/frontend/apps/aov-wiki/src ./src
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/prerender-job.mts"]

# Caddy core has no rate limiter; ADR-007 and spec 01 section 3.3 require one at the proxy.
FROM caddy:2.10-builder AS caddy
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:2.10-alpine AS runtime
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
COPY --from=proxy Caddyfile /etc/caddy/Caddyfile
COPY --from=frontend /workspace/frontend/apps/aov-wiki/dist /srv/wiki
COPY --from=frontend /workspace/frontend/apps/aov-stream/dist /srv/stream
COPY --from=frontend /workspace/frontend/apps/admin-aov/dist /srv/admin
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
# Answered on an internal listener so the check also holds once SITE_ADDRESS is a real domain with TLS.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD wget --quiet --spider http://127.0.0.1:2020/healthz || exit 1
