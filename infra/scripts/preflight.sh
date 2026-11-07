#!/bin/sh
# Runs before anything else starts. A loopback origin may use the sample values of .env.example;
# anything else is reachable by other people and must not.
set -eu

fail() {
    echo "preflight: $1" >&2
    exit 1
}

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
    KEYCLOAK_ADMIN_PASSWORD ADMIN_AUTH_CLIENT_SECRET WIKI_IMPORTER_CLIENT_SECRET STORAGE_SECRET_KEY REDIS_PASSWORD; do
    eval "value=\${$name}"
    case "$value" in
        *change-me*) fail "$name still has the sample value from .env.example." ;;
    esac
done

echo "preflight: public origin checks passed."
