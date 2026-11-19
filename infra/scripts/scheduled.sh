#!/usr/bin/env bash
# The stack's jobs between updates, run by the systemd timers in infra/systemd (ADR-021, addenda of 19/11/2026).
#
#   scheduled.sh pages    prerenders the running release of the Wiki again, so what was published since the last run
#                         gets its page and its line in sitemap.xml; a failed run keeps the pages the site had
#   scheduled.sh backup   dumps the databases under the label `daily`, copies the dumps to OFFSITE_BUCKET, then copies
#                         the new R2 objects
#   scheduled.sh watch    checks that the site answers, the services run, the disk has room and the backups are
#                         recent, and mails the owner when that changes (alert.sh)
#
# All take infra/.deploy/lock, the lock of deploy.sh, so none runs in the middle of an update. Runs on the host as
# the owner of the checkout, like deploy.sh.
set -Eeuo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
infra="$repo/infra"
state="$infra/.deploy"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
# .env is read by Compose, not by a shell (values may hold angle brackets), so values are picked line by line.
env_value() { sed -n "s/^$1=//p" "$infra/.env" | tail -1; }

pages() {
    # An update prerenders the Wiki itself; after a check or a backup the next run comes in fifteen minutes.
    if ! flock --nonblock 9; then
        log "An update or another scheduled job is running, so this run is skipped."
        return 0
    fi
    # An update that stopped half way may already have given the local image name to the image of its commit. The
    # job of that image would see a new release and put its bundle out in front of the backends still running.
    local deployed checkout
    deployed=$(cat "$state/deployed" 2>/dev/null || git -C "$repo" rev-parse HEAD)
    checkout=$(git -C "$repo" rev-parse HEAD)
    if [ "$checkout" != "$deployed" ]; then
        log "The checkout is at ${checkout:0:8} but the stack runs ${deployed:0:8}: an update stopped half way." \
            "The Wiki keeps its pages until an update succeeds."
        return 1
    fi
    docker compose run --rm --no-deps wiki-prerender
}

backup() {
    # Waits for an update to end rather than dumping while Flyway migrates.
    if ! flock --wait 3600 9; then
        log "An update held the lock for an hour, so the databases were not dumped."
        return 1
    fi
    docker compose run --rm --no-deps -e BACKUP_LABEL=daily db-backup
    # The copies do not touch the stack, and the first one of R2 can take long: updates may go on meanwhile. They come
    # after the dump, so every object the dump refers to is in them.
    flock --unlock 9

    local offsite=ok
    if [ -z "$(env_value OFFSITE_BUCKET)" ]; then
        log "OFFSITE_BUCKET is not set in .env, so the dumps stay on this machine only."
    elif ! docker compose run --rm db-offsite; then
        offsite=failed
    fi
    docker compose run --rm media-backup
    if [ "$offsite" = failed ]; then
        log "The dumps were not copied to the offsite bucket; see above."
        return 1
    fi
}

# One line per problem; nothing when all is well.
problems() {
    local origin host port path running service used newest
    origin=$(env_value PUBLIC_ORIGIN)
    if [ "${origin%%://*}" = https ]; then
        host=${origin#https://}
        host=${host%%/*}
        port=$(env_value HTTPS_PORT)
        port=${port:-443}
        for path in / /stream/ /admin/ /api/wiki/v1/regions "/api/community/v1/tournaments?page=0&size=1" \
            /idp/realms/wikiaov/.well-known/openid-configuration; do
            curl --fail --silent --max-time 15 --output /dev/null --resolve "$host:$port:127.0.0.1" \
                "https://$host:$port$path" || echo "$path does not answer through Caddy"
        done
    fi

    running=$(docker compose ps --services --status running)
    for service in postgres redis keycloak wiki-service community-service reverse-proxy; do
        grep -qx "$service" <<<"$running" || echo "$service is not running"
    done
    docker compose ps --format '{{.Service}} {{.Health}}' | awk '$2 == "unhealthy" { print $1 " is unhealthy" }' | sort -u

    used=$(df --output=pcent / | tail -1 | tr -dc 0-9)
    [ "$used" -lt 85 ] || echo "The disk is $used% full"

    newest=$(find "$infra/backups/db" -maxdepth 1 -name 'daily-*' ! -name '*.partial' 2>/dev/null | sort | tail -1)
    if [ -n "$newest" ] && [ -z "$(find "$newest" -maxdepth 0 -mmin -1560)" ]; then
        echo "The newest daily backup, $(basename "$newest"), is more than 26 hours old"
    fi
}

watch() {
    # An update may restart Keycloak or hold two containers of a backend; it checks the site itself at its end.
    if ! flock --nonblock 9; then
        log "An update or a scheduled job is running; the next check follows in five minutes."
        return 0
    fi
    local found seen="$state/alerts/watch" repeat_minutes=360
    found=$(problems)
    if [ -n "$found" ]; then
        # A request that fails once is not worth a mail.
        sleep 30
        found=$(problems)
    fi

    if [ -z "$found" ]; then
        if [ -f "$seen" ]; then
            { printf 'Everything answers again. The last problems were:\n\n'; cat "$seen"; } |
                bash "$infra/scripts/alert.sh" send "the server is well again"
            rm -f "$seen"
        fi
        return 0
    fi

    printf '%s\n' "$found"
    # A new list mails at once, the same one (digits aside: disk percentages, backup names) every six hours.
    if [ ! -f "$seen" ] || [ "$(tr -d 0-9 <"$seen")" != "$(tr -d 0-9 <<<"$found")" ] ||
        [ -z "$(find "$seen" -mmin "-$repeat_minutes")" ]; then
        mkdir -p "$(dirname "$seen")"
        printf '%s\n' "$found" >"$seen"
        {
            printf 'The check of the server found:\n\n%s\n\n' "$found"
            printf 'On the server: docker compose ps, journalctl -u aov-watch.service -n 100\n'
            printf 'Another mail follows when the list changes, every %s hours while it stays, and when all is well.\n' \
                "$((repeat_minutes / 60))"
        } | bash "$infra/scripts/alert.sh" send "the server needs a look"
    fi
    return 1
}

mkdir -p "$state"
exec 9>"$state/lock"
cd "$infra"

case ${1:-} in
    pages) pages ;;
    backup) backup ;;
    watch) watch ;;
    *)
        echo "Usage: scheduled.sh pages|backup|watch" >&2
        exit 2
        ;;
esac
