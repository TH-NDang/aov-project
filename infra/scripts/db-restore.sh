#!/bin/sh
# Replaces every service database with the dumps of one backup. Stop the services first (see infra/README.md).
set -eu

name=${1:-}
if [ -z "$name" ]; then
    echo "Usage: docker compose run --rm db-restore <folder under backups/db>" >&2
    ls -1 /backups/db >&2 2>/dev/null || true
    exit 2
fi

source="/backups/db/$name"
for database in wiki community keycloak; do
    if [ ! -f "$source/$database.dump" ]; then
        echo "Missing $database.dump in backups/db/$name; nothing was changed." >&2
        exit 1
    fi
done

for database in wiki community keycloak; do
    echo "Restoring $database from backups/db/$name"
    psql --host=postgres --username="$PGUSER" --dbname=postgres --set ON_ERROR_STOP=1 \
        --command="DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)" \
        --command="CREATE DATABASE \"$database\" OWNER \"$database\""
    pg_restore --host=postgres --username="$PGUSER" --dbname="$database" --exit-on-error "$source/$database.dump"
done
echo "Restore complete. Start the services again with: docker compose up -d --wait"
