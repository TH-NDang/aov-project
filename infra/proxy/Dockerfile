# syntax=docker/dockerfile:1
# Caddy for the one-machine stack. Neither the configuration nor the frontends are baked in: Compose mounts this folder
# at /etc/caddy, so a new Caddyfile goes live with `caddy reload`, and the frontends come from volumes the web jobs fill
# (ADR-021, addendum of 18/11/2026). This image changes only when Caddy or a module does.

# Caddy core has no rate limiter; ADR-007 and spec 01 section 3.3 require one at the proxy.
FROM caddy:2.10-builder AS caddy
RUN xcaddy build \
    --with github.com/mholt/caddy-ratelimit@5625512f24f6f59d6f64fb3aafe5eecff0b286db

FROM caddy:2.10-alpine AS runtime
COPY --from=caddy /usr/bin/caddy /usr/bin/caddy
# Answered on an internal listener so the check also holds once SITE_ADDRESS is a real domain with TLS.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=6 \
    CMD wget --quiet --spider http://127.0.0.1:2020/healthz || exit 1
