#!/bin/bash
# Creates the sign-in accounts of the bundled test identity setup (Compose profile "test-identity").
# Safe to run again: existing accounts keep their id and get the password from .env.
set -euo pipefail

export HOME=/tmp
kcadm=/opt/keycloak/bin/kcadm.sh
realm=wikiaov

"$kcadm" config credentials --server http://keycloak:8080/idp --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"

ensure_user() {
    local username=$1 role=$2 last_name=$3
    local id
    id=$("$kcadm" get users -r "$realm" -q "username=$username" -q exact=true --fields id --format csv --noquotes)
    if [ -z "$id" ]; then
        "$kcadm" create users -r "$realm" -s "username=$username" -s enabled=true \
            -s "email=$username@wikiaov.test" -s emailVerified=true \
            -s firstName=Test -s "lastName=$last_name"
    fi
    "$kcadm" set-password -r "$realm" --username "$username" --new-password "$TEST_USER_PASSWORD"
    "$kcadm" add-roles -r "$realm" --uusername "$username" --rolename "$role"
    echo "Test account ready: $username ($role)"
}

ensure_user admin wiki-admin Admin
ensure_user editor wiki-editor Editor
ensure_user publisher wiki-publisher Publisher
