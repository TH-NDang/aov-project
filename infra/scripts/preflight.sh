#!/bin/sh
# Runs before anything else starts. Object storage is Cloudflare R2 on every origin, so its values are checked first
# and every problem is listed at once. A loopback origin may then keep the sample secrets of .env.example; anything
# else is reachable by other people and must not.
set -eu

fail() {
    echo "preflight: $1" >&2
    exit 1
}

problems=
problem() {
    problems="$problems
  - $1"
}

# True when the variable named $1 holds a value of its own. Samples in .env.example are written in angle brackets,
# which no real key, bucket name or address contains.
filled() {
    eval "value=\${$1:-}"
    case "$value" in
        '' | *'<'* | *'>'*) return 1 ;;
    esac
}

for name in STORAGE_ENDPOINT STORAGE_ACCESS_KEY STORAGE_SECRET_KEY STORAGE_BUCKET STORAGE_ASSETS_BUCKET \
    STORAGE_SOURCES_BUCKET MEDIA_PUBLIC_BASE_URL; do
    eval "value=\${$name:-}"
    if [ -z "$value" ]; then
        problem "$name is missing."
    elif ! filled "$name"; then
        problem "$name still has the sample value from .env.example."
    fi
done

if filled STORAGE_ENDPOINT; then
    case "$STORAGE_ENDPOINT" in
        https://*) ;;
        *) problem "STORAGE_ENDPOINT must be the https:// address of the R2 S3 API." ;;
    esac
fi

if [ -n "${STORAGE_PUBLIC_ENDPOINT:-}" ]; then
    if ! filled STORAGE_PUBLIC_ENDPOINT; then
        problem "STORAGE_PUBLIC_ENDPOINT still has a sample value; leave it empty to use STORAGE_ENDPOINT."
    else
        case "$STORAGE_PUBLIC_ENDPOINT" in
            https://*) ;;
            *) problem "STORAGE_PUBLIC_ENDPOINT must be an https:// address, or empty to use STORAGE_ENDPOINT." ;;
        esac
    fi
fi

if filled MEDIA_PUBLIC_BASE_URL; then
    case "$MEDIA_PUBLIC_BASE_URL" in
        https://*/assets) ;;
        *) problem "MEDIA_PUBLIC_BASE_URL must be https://<image domain>/assets, without a trailing slash." ;;
    esac
fi

# The assets bucket is public: sharing it would publish pending uploads or private source files.
if filled STORAGE_ASSETS_BUCKET; then
    if [ "$STORAGE_ASSETS_BUCKET" = "${STORAGE_BUCKET:-}" ]; then
        problem "STORAGE_ASSETS_BUCKET is public and must not be STORAGE_BUCKET."
    fi
    if [ "$STORAGE_ASSETS_BUCKET" = "${STORAGE_SOURCES_BUCKET:-}" ]; then
        problem "STORAGE_ASSETS_BUCKET is public and must not be STORAGE_SOURCES_BUCKET."
    fi
fi

case "${MEDIA_CLOUDFLARE_PURGE_ENABLED:-false}" in
    true)
        if [ -z "${CLOUDFLARE_ZONE_ID:-}" ]; then
            problem "CLOUDFLARE_ZONE_ID is missing (MEDIA_CLOUDFLARE_PURGE_ENABLED=true)."
        elif ! printf '%s' "$CLOUDFLARE_ZONE_ID" | grep -Eq '^[0-9a-fA-F]{32}$'; then
            problem "CLOUDFLARE_ZONE_ID must be the 32-character zone ID of the image domain, not the account ID."
        fi
        if [ -z "${CLOUDFLARE_CACHE_PURGE_TOKEN:-}" ]; then
            problem "CLOUDFLARE_CACHE_PURGE_TOKEN is missing (MEDIA_CLOUDFLARE_PURGE_ENABLED=true)."
        elif ! filled CLOUDFLARE_CACHE_PURGE_TOKEN; then
            problem "CLOUDFLARE_CACHE_PURGE_TOKEN still has a sample value."
        fi
        ;;
    false)
        echo "preflight: MEDIA_CLOUDFLARE_PURGE_ENABLED=false, so deleting an image will be refused."
        ;;
    *)
        problem "MEDIA_CLOUDFLARE_PURGE_ENABLED must be true or false."
        ;;
esac

if [ -n "$problems" ]; then
    echo "preflight: object storage (Cloudflare R2) is not ready in .env:$problems" >&2
    echo "preflight: infra/README.md, section \"Cloudflare R2\", lists what to prepare." >&2
    exit 1
fi
echo "preflight: object storage values are set."

case "$PUBLIC_ORIGIN" in
    */) fail "PUBLIC_ORIGIN must not end with a slash." ;;
    http://localhost | http://localhost:* | http://127.0.0.1 | http://127.0.0.1:*)
        echo "preflight: loopback origin, skipping the public deployment checks."
        exit 0
        ;;
    https://*) ;;
    *) fail "PUBLIC_ORIGIN must be https:// unless it is a loopback address." ;;
esac

[ "$AUTH_SECURE_COOKIES" = "true" ] || fail "AUTH_SECURE_COOKIES must be true on a public origin."

case ",$COMPOSE_PROFILES," in
    *,test-identity,*) fail "Remove test-identity from COMPOSE_PROFILES on a public origin." ;;
esac

for name in POSTGRES_SUPERUSER_PASSWORD WIKI_DB_PASSWORD COMMUNITY_DB_PASSWORD KEYCLOAK_DB_PASSWORD \
    KEYCLOAK_ADMIN_PASSWORD ADMIN_AUTH_CLIENT_SECRET WIKI_IMPORTER_CLIENT_SECRET WIKI_SERVICE_CLIENT_SECRET \
    REDIS_PASSWORD; do
    eval "value=\${$name}"
    case "$value" in
        *change-me*) fail "$name still has the sample value from .env.example." ;;
    esac
done

# Only a warning: refusing would stop a running site at its next update. Rotate any secret listed here.
for name in POSTGRES_SUPERUSER_PASSWORD WIKI_DB_PASSWORD COMMUNITY_DB_PASSWORD KEYCLOAK_DB_PASSWORD \
    KEYCLOAK_ADMIN_PASSWORD ADMIN_AUTH_CLIENT_SECRET WIKI_IMPORTER_CLIENT_SECRET WIKI_SERVICE_CLIENT_SECRET \
    REDIS_PASSWORD; do
    eval "value=\${$name}"
    if [ "${#value}" -lt 24 ]; then
        echo "preflight: warning: $name is shorter than 24 characters; use a longer random value." >&2
    fi
done

echo "preflight: public origin checks passed."
