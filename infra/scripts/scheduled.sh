#!/usr/bin/env bash
# The stack's jobs between updates, run by the systemd timers in infra/systemd (ADR-021, addendum of 19/11/2026).
#
#   scheduled.sh pages    prerenders the running release of the Wiki again, so what was published since the last run
#                         gets its page and its line in sitemap.xml; a failed run keeps the pages the site had
#   scheduled.sh backup   dumps the databases under the label `daily`, then copies the new R2 objects
#
# Both take infra/.deploy/lock, the lock of deploy.sh, so neither runs in the middle of an update. Runs on the host as
# the owner of the checkout, like deploy.sh.
set -Eeuo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
infra="$repo/infra"
state="$infra/.deploy"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

mkdir -p "$state"
exec 9>"$state/lock"
cd "$infra"

case ${1:-} in
    pages)
        if ! flock --nonblock 9; then
            log "An update is running, and it prerenders the Wiki itself."
            exit 0
        fi
        # An update that stopped half way may already have given the local image name to the image of its commit. The
        # job of that image would see a new release and put its bundle out in front of the backends still running.
        deployed=$(cat "$state/deployed" 2>/dev/null || git -C "$repo" rev-parse HEAD)
        checkout=$(git -C "$repo" rev-parse HEAD)
        if [ "$checkout" != "$deployed" ]; then
            log "The checkout is at ${checkout:0:8} but the stack runs ${deployed:0:8}: an update stopped half way." \
                "The Wiki keeps its pages until an update succeeds."
            exit 1
        fi
        docker compose run --rm --no-deps wiki-prerender
        ;;
    backup)
        # Waits for an update to end rather than dumping while Flyway migrates.
        if ! flock --wait 3600 9; then
            log "An update held the lock for an hour, so the databases were not dumped."
            exit 1
        fi
        docker compose run --rm --no-deps -e BACKUP_LABEL=daily db-backup
        # Copying R2 does not touch the stack, and the first copy can take long: updates may go on meanwhile. It comes
        # after the dump, so every object the dump refers to is in the copy.
        flock --unlock 9
        docker compose run --rm media-backup
        ;;
    *)
        echo "Usage: scheduled.sh pages|backup" >&2
        exit 2
        ;;
esac
