#!/bin/bash
# Applies the security settings of the realm template to a realm that already exists: Keycloak reads the realm file
# only when it first creates the realm. Safe to run again: docker compose run --rm keycloak-harden
#
# Always:
#   - the public Wiki and Stream clients get no client roles in their tokens (fullScopeAllowed=false);
#   - the password policy of the template (new and changed passwords only; current passwords keep working).
# Only when asked, because each one can stop a person from signing in until they act:
#   - REQUIRE_STAFF_OTP=true: every account holding a wiki-* or community-* role must set up an authenticator app at its
#     next sign-in through the account console (<origin>/idp/realms/wikiaov/account); the Admin sign-in form then asks
#     for the code. Until it is set up, the Admin sign-in answers that the account is not fully set up.
#   - VERIFY_EMAIL=true: new accounts confirm their address by mail. Needs SMTP (keycloak-mail) first; accounts whose
#     address is not verified yet are asked to verify it at their next sign-in.
set -euo pipefail

export HOME=/tmp
kcadm=/opt/keycloak/bin/kcadm.sh
realm=wikiaov
policy='length(12) and maxLength(128) and notUsername and notEmail and passwordHistory(3)'

"$kcadm" config credentials --server http://keycloak:8080/idp --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"

client_id() {
    "$kcadm" get clients -r "$realm" -q "clientId=$1" --fields id --format csv --noquotes | head -n 1
}

for client in aov-wiki aov-stream; do
    id=$(client_id "$client")
    if [ -z "$id" ]; then
        echo "Client $client does not exist; skipped." >&2
        continue
    fi
    "$kcadm" update "clients/$id" -r "$realm" -s fullScopeAllowed=false
    echo "Client $client: tokens no longer carry client roles."
done

"$kcadm" update "realms/$realm" -s "passwordPolicy=$policy"
echo "Password policy: $policy"

if [ "${VERIFY_EMAIL:-false}" = "true" ]; then
    host=$("$kcadm" get "realms/$realm" --fields smtpServer.host --format csv --noquotes || true)
    if [ -z "$host" ]; then
        echo "VERIFY_EMAIL=true needs SMTP: run keycloak-mail first." >&2
        exit 1
    fi
    "$kcadm" update "realms/$realm" -s verifyEmail=true
    echo "New accounts must verify their email address."
fi

if [ "${REQUIRE_STAFF_OTP:-false}" = "true" ]; then
    for role in wiki-editor wiki-publisher wiki-patch-manager wiki-admin community-editor community-publisher \
        community-admin; do
        # Direct members of the role; composite roles are listed one by one above.
        "$kcadm" get "roles/$role/users" -r "$realm" --fields id,username --format csv --noquotes 2>/dev/null || true
    done | sort -u | while IFS=, read -r id username; do
        [ -n "$id" ] || continue
        otp=$("$kcadm" get "users/$id/credentials" -r "$realm" --fields type --format csv --noquotes | grep -c '^otp$' || true)
        if [ "$otp" -gt 0 ]; then
            echo "$username already has an authenticator app."
            continue
        fi
        "$kcadm" update "users/$id" -r "$realm" -s 'requiredActions=["CONFIGURE_TOTP"]'
        echo "$username must set up an authenticator app at the next sign-in."
    done
fi
