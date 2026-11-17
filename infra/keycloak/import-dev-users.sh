#!/bin/bash
# Adds the accounts of the development realm (keycloak-users.json from export-for-stack.ps1) to this stack's realm,
# keeping their ids, password hashes, roles and Google links, so that the data moved by dev-import still names them.
# Run once, right after dev-import; see infra/README.md, section on moving the dev data.
set -euo pipefail

name=${1:-}
if [ -z "$name" ]; then
    echo "Usage: docker compose run --rm dev-users-import <folder under backups/db>" >&2
    ls -1 /backups/db >&2 2>/dev/null || true
    exit 2
fi
file="/backups/db/$name/keycloak-users.json"
if [ ! -f "$file" ]; then
    echo "Missing keycloak-users.json in backups/db/$name; nothing was changed." >&2
    exit 1
fi

export HOME=/tmp
kcadm=/opt/keycloak/bin/kcadm.sh
realm=wikiaov

"$kcadm" config credentials --server http://keycloak:8080/idp --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"

# Accounts are matched by name and overwritten. After launch that would put stale development copies over accounts
# people use, so the import only runs on a realm without people (service accounts do not count).
people=$("$kcadm" get users -r "$realm" --fields username --format csv --noquotes | grep -cv '^service-account-' || true)
if [ "$people" != "0" ]; then
    echo "Realm $realm already has $people accounts; nothing was imported." >&2
    exit 1
fi

"$kcadm" create partialImport -r "$realm" -s ifResourceExists=OVERWRITE -o -f "$file" > /tmp/import-result.json
grep -o '"\(added\|overwritten\|skipped\)" *: *[0-9]*' /tmp/import-result.json | tr -d '" ' | tr '\n' ' '
echo

# The test accounts of the local realm have their passwords in the public repository. They are kept, disabled, so
# that the content they wrote still has an author.
for username in $DISABLED_USERNAMES; do
    id=$("$kcadm" get users -r "$realm" -q "username=$username" -q exact=true --fields id --format csv --noquotes)
    if [ -n "$id" ]; then
        "$kcadm" update "users/$id" -r "$realm" -s enabled=false
        echo "Disabled test account $username."
    fi
done
echo "Accounts imported. Start the services again with: docker compose up -d --wait"
