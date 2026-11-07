#!/bin/sh
# Runs once, when the data directory is empty. One database and one login per service (spec 01, section 3.8).
# Passwords changed later in .env must also be changed in PostgreSQL (see infra/README.md).
set -eu

create_database() {
    psql --set ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
        --set name="$1" --set password="$2" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'name', :'password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'name', :'name') \gexec
SQL
}

create_database wiki "$WIKI_DB_PASSWORD"
create_database community "$COMMUNITY_DB_PASSWORD"
create_database keycloak "$KEYCLOAK_DB_PASSWORD"
