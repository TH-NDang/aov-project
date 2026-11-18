#!/bin/sh
# Replaces the wiki and community databases with an export of the development environment
# (backend/wiki-service/scripts/dev/export-for-stack.ps1), then moves its accounts to the issuer of this stack.
# Stop the services first and run dev-users-import right after; see infra/README.md, section on moving the dev data.
set -eu

name=${1:-}
if [ -z "$name" ]; then
    echo "Usage: docker compose run --rm dev-import <folder under backups/db>" >&2
    ls -1 /backups/db >&2 2>/dev/null || true
    exit 2
fi
: "${STACK_ISSUER:?is missing}"

source="/backups/db/$name"
for file in wiki.dump community.dump keycloak-users.json; do
    if [ ! -f "$source/$file" ]; then
        echo "Missing $file in backups/db/$name; nothing was changed." >&2
        exit 1
    fi
done

for database in wiki community; do
    echo "Restoring $database from backups/db/$name"
    psql --host=postgres --username="$PGUSER" --dbname=postgres --set ON_ERROR_STOP=1 \
        --command="DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)" \
        --command="CREATE DATABASE \"$database\" OWNER \"$database\""
    pg_restore --host=postgres --username="$PGUSER" --dbname="$database" --exit-on-error "$source/$database.dump"
done

# Data names a person by the pair (issuer, subject). dev-users-import keeps every subject, so only the issuer changes:
# every value ending in /realms/wikiaov becomes this stack's. Other values name actors outside Keycloak and stay.
# Published revisions and the audit log refuse updates through triggers. Moving the issuer changes no content, so
# this one transaction runs with triggers off (replica role); no foreign key includes an issuer column.
echo "Moving accounts to the issuer $STACK_ISSUER"
psql --host=postgres --username="$PGUSER" --dbname=wiki --quiet --set ON_ERROR_STOP=1 \
    --set stack_issuer="$STACK_ISSUER" <<'SQL'
SELECT set_config('aov.stack_issuer', :'stack_issuer', false) \g /dev/null
BEGIN;
SET LOCAL session_replication_role = replica;
DO $$
DECLARE
    stack_issuer text := current_setting('aov.stack_issuer');
    issuer_column record;
    dev_issuers text[];
    changed bigint;
    total bigint := 0;
BEGIN
    CREATE TEMPORARY TABLE issuer_column ON COMMIT DROP AS
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t USING (table_schema, table_name)
    WHERE t.table_type = 'BASE TABLE'
      AND (c.column_name = 'issuer' OR c.column_name LIKE '%\_issuer')
      AND c.data_type IN ('text', 'character varying')
      AND c.table_schema NOT IN ('pg_catalog', 'information_schema');

    CREATE TEMPORARY TABLE dev_issuer (value text PRIMARY KEY) ON COMMIT DROP;
    FOR issuer_column IN SELECT * FROM issuer_column LOOP
        EXECUTE format('INSERT INTO dev_issuer SELECT DISTINCT %1$I FROM %2$I.%3$I WHERE %1$I LIKE %4$L AND %1$I <> $1 '
                || 'ON CONFLICT DO NOTHING', issuer_column.column_name, issuer_column.table_schema,
                issuer_column.table_name, '%/realms/wikiaov')
            USING stack_issuer;
    END LOOP;
    SELECT array_agg(value ORDER BY value) INTO dev_issuers FROM dev_issuer;
    IF dev_issuers IS NULL THEN
        RAISE NOTICE 'No row names a development issuer; nothing to move.';
        RETURN;
    END IF;
    RAISE NOTICE 'Development issuers: %', array_to_string(dev_issuers, ', ');

    FOR issuer_column IN SELECT * FROM issuer_column LOOP
        EXECUTE format('UPDATE %2$I.%3$I SET %1$I = $1 WHERE %1$I = ANY ($2)', issuer_column.column_name,
                issuer_column.table_schema, issuer_column.table_name)
            USING stack_issuer, dev_issuers;
        GET DIAGNOSTICS changed = ROW_COUNT;
        total := total + changed;
    END LOOP;
    RAISE NOTICE 'Moved % values in % columns.', total, (SELECT count(*) FROM issuer_column);
END
$$;
COMMIT;
SQL
echo "Import complete. Now run: docker compose run --rm dev-users-import $name"
