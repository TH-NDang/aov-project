#!/usr/bin/env bash
# Mails the owner of the server (ALERT_EMAIL in infra/.env) through the SMTP relay of MAIL_* (ADR-021, addendum of
# 19/11/2026 on alerts and offsite backups).
#
#   alert.sh failed <unit>    the log of the unit's last run; aov-alert@.service runs it for OnFailure=
#   alert.sh send <subject>   standard input as the body
#
# Without MAIL_HOST, MAIL_PASSWORD or ALERT_EMAIL nothing is sent and the message only goes to the journal.
set -Eeuo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
infra="$repo/infra"
marks="$infra/.deploy/alerts"
# The same fault mails again after this many minutes; a different one mails at once.
repeat_minutes=360

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
# .env is read by Compose, not by a shell (values may hold angle brackets), so values are picked line by line.
env_value() { sed -n "s/^$1=//p" "$infra/.env" | tail -1; }

send() {
    local subject=$1 body host port user password from to address site
    body=$(cat)
    host=$(env_value MAIL_HOST)
    port=$(env_value MAIL_PORT)
    user=$(env_value MAIL_USERNAME)
    password=$(env_value MAIL_PASSWORD)
    from=$(env_value MAIL_FROM)
    to=$(env_value ALERT_EMAIL)
    site=$(env_value PUBLIC_ORIGIN)
    site=${site#*://}

    if [ -z "$host" ] || [ -z "$password" ] || [ -z "$to" ]; then
        log "Mail is not set up (MAIL_HOST, MAIL_PASSWORD and ALERT_EMAIL in infra/.env), so this was not sent: $subject"
        printf '%s\n' "$body"
        return 0
    fi

    # MAIL_FROM may carry a display name: "AOV <no-reply@example.com>".
    address=${from##*<}
    address=${address%%>*}
    # The password goes through a config file descriptor, never the command line that other processes can read.
    {
        printf 'From: %s\nTo: %s\nSubject: [%s] %s\nDate: %s\nMIME-Version: 1.0\n' "$from" "$to" "$site" "$subject" \
            "$(date -R)"
        printf 'Content-Type: text/plain; charset=UTF-8\n\n%s\n' "$body"
    } | curl --silent --show-error --fail --max-time 60 --url "smtp://$host:${port:-587}" --ssl-reqd --crlf \
        --mail-from "$address" --mail-rcpt "$to" --upload-file - \
        --config <(printf 'user = "%s:%s"\n' "$user" "$password")
    log "Mailed $to: $subject"
}

failed() {
    local unit=$1 invocation last key mark
    invocation=$(systemctl show --property=InvocationID --value "$unit")
    # A repeat is told by the run's last line without its time, which names the commit or the job's own reason.
    last=$(journalctl --no-pager --output=cat "_SYSTEMD_INVOCATION_ID=$invocation" | grep -v '^[[:space:]]*$' | tail -n 1 |
        sed -E 's/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z //' || true)
    key=$(printf '%s' "$last" | sha256sum | cut -c1-16)
    mark="$marks/$unit.$key"
    if [ -n "$(find "$mark" -mmin "-$repeat_minutes" 2>/dev/null)" ]; then
        log "$unit failed the same way as before; it was mailed less than $((repeat_minutes / 60)) hours ago."
        return 0
    fi
    mkdir -p "$marks"
    find "$marks" -maxdepth 1 -name "$unit.*" -delete
    touch "$mark"

    {
        printf 'The last run of %s failed. Its log:\n\n' "$unit"
        journalctl --no-pager --output=short-iso "_SYSTEMD_INVOCATION_ID=$invocation" | tail -n 80
        printf '\nOn the server: journalctl -u %s -n 200\n' "$unit"
        printf 'The same failure is mailed again after %s hours at the earliest.\n' "$((repeat_minutes / 60))"
    } | send "$unit failed"
}

case ${1:-} in
    failed) failed "${2:?Usage: alert.sh failed <unit>}" ;;
    send) send "${2:?Usage: alert.sh send <subject>}" ;;
    *)
        echo "Usage: alert.sh failed <unit> | alert.sh send <subject>" >&2
        exit 2
        ;;
esac
