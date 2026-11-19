# syntax=docker/dockerfile:1
# Static builds of the three frontend apps (spec 01, section 3.4) and the one-shot jobs that publish them into the volumes
# Caddy serves, so a new frontend goes live without a new proxy container (ADR-021, addendum of 18/11/2026; ADR-022).
# Build context is frontend/.
# Images are not bundled: every public picture is a Media URL (ADR-030), so no Git LFS file is needed here.

FROM node:22-bookworm-slim AS frontend
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 CI=true
RUN corepack enable
WORKDIR /workspace/frontend
COPY . .
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

# Two one-shot jobs of Compose run from this image: web-publish (Stream and Admin) and wiki-prerender (the Wiki, which
# needs the API and so cannot be rendered while images build).
FROM node:22-bookworm-slim AS web
WORKDIR /job
COPY --from=frontend /workspace/frontend/apps/aov-wiki/package.json ./
COPY --from=frontend /workspace/frontend/apps/aov-wiki/dist ./dist
COPY --from=frontend /workspace/frontend/apps/aov-wiki/scripts ./scripts
COPY --from=frontend /workspace/frontend/apps/aov-wiki/src ./src
# The prerender scripts import @aov/ui/lib/*. Node strips TypeScript types only outside node_modules, so the package
# lives in packages/ui and node_modules holds a link to it; Node follows the link to the real path.
COPY --from=frontend /workspace/frontend/packages/ui/package.json ./packages/ui/
COPY --from=frontend /workspace/frontend/packages/ui/src/lib ./packages/ui/src/lib
RUN mkdir -p node_modules/@aov && ln -s ../../packages/ui node_modules/@aov/ui
COPY --from=frontend /workspace/frontend/apps/aov-stream/dist ./apps/stream
COPY --from=frontend /workspace/frontend/apps/admin-aov/dist ./apps/admin
CMD ["node", "--experimental-strip-types", "--disable-warning=ExperimentalWarning", "scripts/prerender-job.mts"]
