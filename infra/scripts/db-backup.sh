#!/bin/sh
# Dumps every service database into backups/db/<label>-<UTC time>/.
# Compose runs it before the services start, so each Flyway migration has a dump from just before it.
set -eu

label=${BACKUP_LABEL:-manual}
keep=${BACKUP_KEEP:-10}
stamp=$(date -u +%Y%m%dT%H%M%SZ)
target="/backups/db/$label-$stamp"

mkdir -p "$target.partial"
for database in wiki community keycloak; do
    pg_dump --host=postgres --username="$PGUSER" --format=custom --file="$target.partial/$database.dump" "$database"
done
mv "$target.partial" "$target"
echo "Backup written: backups/db/$label-$stamp"

# A manual backup stays until someone removes it; every other label keeps its newest few.
if [ "$label" != "manual" ]; then
    ls -1d "/backups/db/$label"-* | sort -r | tail -n "+$((keep + 1))" | while read -r old; do
        rm -rf "$old"
        echo "Removed old backup: $(basename "$old")"
    done
fi
