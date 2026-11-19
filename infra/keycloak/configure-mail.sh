#!/bin/bash
# Gives the realm the SMTP relay of MAIL_* in .env, so that Keycloak can mail password reset links, and turns on
# "Forgot password" (ADR-021, addendum of 19/11/2026 on alerts and offsite backups). Keycloak reads the realm file only
# when it first creates the realm, so run this after every change of MAIL_*: docker compose run --rm keycloak-mail
set -euo pipefail

: "${MAIL_HOST:?is missing in .env}"
: "${MAIL_PASSWORD:?is missing in .env}"
: "${MAIL_FROM:?is missing in .env}"

# MAIL_FROM may carry a display name: "AOV <no-reply@example.com>".
address=${MAIL_FROM##*<}
address=${address%%>*}
name=""
if [ "$address" != "$MAIL_FROM" ]; then
    name=${MAIL_FROM%%<*}
    name=${name% }
fi

export HOME=/tmp
kcadm=/opt/keycloak/bin/kcadm.sh
realm=wikiaov

"$kcadm" config credentials --server http://keycloak:8080/idp --realm master \
    --user "$KC_BOOTSTRAP_ADMIN_USERNAME" --password "$KC_BOOTSTRAP_ADMIN_PASSWORD"

"$kcadm" update "realms/$realm" \
    -s resetPasswordAllowed=true \
    -s "smtpServer.host=$MAIL_HOST" \
    -s "smtpServer.port=$MAIL_PORT" \
    -s "smtpServer.from=$address" \
    -s "smtpServer.fromDisplayName=$name" \
    -s "smtpServer.auth=$MAIL_SMTP_AUTH" \
    -s "smtpServer.starttls=$MAIL_STARTTLS" \
    -s smtpServer.ssl=false \
    -s "smtpServer.user=$MAIL_USERNAME" \
    -s "smtpServer.password=$MAIL_PASSWORD"

echo "Realm $realm mails through $MAIL_HOST:$MAIL_PORT as $address, and Forgot password is on."
