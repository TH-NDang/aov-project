#!/usr/bin/env bash
# Brings the stack on this machine to a commit without taking the site down (ADR-021, addendum of 18/11/2026). The
# containers of the running version keep serving until the new ones are healthy; then the old ones stop.
#
#   deploy.sh              the newest commit of main, once every GitHub check of it has passed (the systemd timer)
#   deploy.sh <commit>     that commit, checks or not: a rollback, or a commit you accept by hand
#   deploy.sh --refresh    the running commit again: new backend containers, frontends and Caddy configuration, for a
#                          changed .env; Keycloak and the Caddy container are left alone
#
# Runs on the host as the owner of the checkout, with git, Docker Compose, curl, python3 and flock. State lives in
# infra/.deploy (ignored by git): `deployed` is the commit the containers run, `rejected` the last commit that failed,
# which the timer does not try again; a newer commit or a run by hand does.
set -Eeuo pipefail

repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
infra="$repo/infra"
state="$infra/.deploy"
github_repo=${DEPLOY_GITHUB_REPO:-TH-NDang/aov-project}
registry=${DEPLOY_REGISTRY:-ghcr.io/th-ndang/aov-project}

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
# .env is read by Compose, not by a shell (values may hold angle brackets), so values are picked line by line.
env_value() { sed -n "s/^$1=//p" "$infra/.env" | tail -1; }

mkdir -p "$state"
exec 9>"$state/lock"
if ! flock --nonblock 9; then
    log "Another update is running."
    exit 0
fi
cd "$infra"

refresh=false
automatic=false
if ! git -C "$repo" fetch --quiet origin main; then
    log "GitHub cannot be reached."
    [ -n "${1:-}" ] || exit 0
fi
deployed=$(cat "$state/deployed" 2>/dev/null || git -C "$repo" rev-parse HEAD)
case ${1:-} in
    --refresh) refresh=true; target=$deployed ;;
    "") automatic=true; target=$(git -C "$repo" rev-parse origin/main) ;;
    *) target=$(git -C "$repo" rev-parse --verify --quiet "$1^{commit}") || { log "Unknown commit: $1"; exit 2; } ;;
esac
short=${target:0:8}

if ! $refresh && [ "$target" = "$deployed" ]; then
    exit 0
fi
if $automatic && [ "$(cat "$state/rejected" 2>/dev/null)" = "$target" ]; then
    exit 0
fi
# The timer only moves forward. A main that does not build on the running commit (rewritten history, or a server ahead
# of main) is left for a run by hand.
if $automatic && ! git -C "$repo" merge-base --is-ancestor "$deployed" "$target" 2>/dev/null; then
    log "main is at $short, which does not follow the running ${deployed:0:8}; the timer leaves it. Deploy it by hand if" \
        "that is intended."
    echo "$target" >"$state/rejected"
    exit 0
fi

# passed, pending or failed, from the check runs GitHub keeps for the commit. Every commit of main has at least the
# images workflow, so no run at all means the checks have not started yet.
checks() {
    curl --fail --silent --show-error --max-time 20 -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$github_repo/commits/$1/check-runs?per_page=100" | python3 -c '
import json, sys
runs = json.load(sys.stdin).get("check_runs", [])
if not runs or any(run["status"] != "completed" for run in runs):
    print("pending")
elif all(run["conclusion"] in ("success", "skipped", "neutral") for run in runs):
    print("passed")
else:
    print("failed")'
}

if $automatic; then
    case $(checks "$target" || echo unreachable) in
        passed) ;;
        pending | unreachable) exit 0 ;;
        *)
            log "A check of $short failed, so it is not deployed."
            echo "$target" >"$state/rejected"
            exit 1
            ;;
    esac
fi

if [ -n "$(git -C "$repo" status --porcelain --untracked-files=no)" ]; then
    log "Tracked files were changed on this machine. Commit or undo them, then run again."
    exit 1
fi

fail() {
    log "Update to $short stopped: $1. The containers that were serving keep serving."
    echo "$target" >"$state/rejected"
    exit 1
}
trap 'fail "a command failed at line $LINENO"' ERR

# What the update touches, from the files that differ. Keycloak and the Caddy container cannot run side by side, so they
# are replaced only when their own files change.
if $refresh; then
    changes="backend/wiki-service/src/ backend/community-service/ frontend/ infra/proxy/Caddyfile"
else
    changes=$(git -C "$repo" diff --name-only "$deployed" "$target" 2>/dev/null || echo "everything/")
fi
changes=$(tr ' ' '\n' <<<"$changes")
changed() { grep -qE "$1" <<<"$changes"; }
stack=false wiki=false community=false web=false keycloak=false proxy_image=false caddyfile=false
changed '^(everything/|infra/compose\.yaml|infra/postgres/)' && stack=true
changed '^(everything/|backend/wiki-service/(src/|pom\.xml|Dockerfile|\.mvn/|mvnw$))' && wiki=true
changed '^(everything/|backend/community-service/)' && community=true
changed '^(everything/|frontend/|infra/web/)' && web=true
changed '^(everything/|infra/keycloak/|backend/wiki-service/infra/local/keycloak-themes/)' && keycloak=true
changed '^(everything/|infra/proxy/Dockerfile$)' && proxy_image=true
changed '^(everything/|infra/proxy/Caddyfile$)' && caddyfile=true
# Compose settings may change any service: the backends and the frontends follow at no cost.
if $stack; then wiki=true community=true web=true; fi

log "Updating to $short: stack=$stack wiki=$wiki community=$community web=$web keycloak=$keycloak" \
    "proxy-image=$proxy_image caddyfile=$caddyfile"
git -C "$repo" checkout --quiet --detach "$target"

# Images: those CI pushed for this commit (.github/workflows/images.yml), otherwise built here while the old containers
# keep serving. Both end up under the local names Compose uses, so `docker compose` alone keeps working.
tag=$(env_value IMAGE_TAG)
tag=${tag:-local}
build=()
prepare() {
    local service=$1 image=$2
    if docker pull --quiet "$registry/$image:$target" >/dev/null 2>&1; then
        docker tag "$registry/$image:$target" "aov/$image:$tag"
        log "$image: image of $short from the registry"
    else
        build+=("$service")
    fi
}
$wiki && prepare wiki-service wiki-service
$community && prepare community-service community-service
$keycloak && prepare keycloak keycloak
$proxy_image && prepare reverse-proxy reverse-proxy
$web && prepare web-publish web
if [ ${#build[@]} -gt 0 ]; then
    log "Building here: ${build[*]}"
    docker compose build "${build[@]}"
fi

docker compose run --rm --no-deps preflight

# Same rule as `up`: a backup before Flyway runs. Migrations must leave the old version working, because both run
# against the new schema until the old containers stop.
if $wiki || $community; then
    docker compose run --rm --no-deps db-backup
fi

healthy() {
    local deadline=$((SECONDS + 900)) id status
    for id in "$@"; do
        while :; do
            status=$(docker inspect --format '{{if .State.Running}}{{.State.Health.Status}}{{else}}exited{{end}}' \
                "$id" 2>/dev/null || echo gone)
            case $status in
                healthy) break ;;
                starting) ;;
                *) return 1 ;;
            esac
            [ "$SECONDS" -lt "$deadline" ] || return 1
            sleep 3
        done
    done
}

answers() {
    local port=$1 path=$2 id
    shift 2
    for id in "$@"; do
        docker exec "$id" curl --fail --silent --show-error --max-time 10 --output /dev/null \
            "http://127.0.0.1:$port$path" || return 1
    done
}

# Starts new containers next to the running ones, which keep their image; Caddy reaches both by the service name. Once
# the new ones are healthy and answer, the old ones stop, finishing their requests first. A new container that fails
# is removed and the old one never noticed.
roll() {
    local service=$1 port=$2 path=$3 old new
    old=$(docker compose ps --quiet "$service")
    if [ -z "$old" ]; then
        docker compose up --detach --no-deps --wait "$service"
        return
    fi
    docker compose up --detach --no-deps --no-recreate --scale "$service=$(($(wc -l <<<"$old") * 2))" "$service"
    new=$(docker compose ps --quiet "$service" | grep --invert-match --line-regexp --fixed-strings "$old" || true)
    [ -n "$new" ] || fail "$service: no new container was created"
    # shellcheck disable=SC2086 # one id per word
    if ! healthy $new || ! answers "$port" "$path" $new; then
        for id in $new; do docker logs --tail 60 "$id" 2>&1 | sed "s/^/    /"; done
        docker rm --force $new >/dev/null
        fail "$service: the new container did not become healthy and was removed"
    fi
    # shellcheck disable=SC2086
    docker stop --time 40 $old >/dev/null
    # shellcheck disable=SC2086
    docker rm $old >/dev/null
    log "$service: the new container serves; the old one stopped"
}

$community && roll community-service 8082 "/api/community/v1/tournaments?page=0&size=1"
$wiki && roll wiki-service 8080 /api/wiki/v1/regions

# Frontends after the backends, so a new page never calls an API that is not there yet.
if $web; then
    docker compose run --rm --no-deps web-publish
fi
if $web || $wiki; then
    # A failed run keeps the pages of the running release; a new release goes out without pages (ADR-022, addendum of
    # 19/11/2026). The job says which, and the update goes on either way.
    docker compose run --rm --no-deps wiki-prerender || log "wiki-prerender failed; see above for what the Wiki serves."
fi

if $proxy_image; then
    log "reverse-proxy: new Caddy image; requests pause for a few seconds while the container is replaced."
    docker compose up --detach --no-deps --wait reverse-proxy
elif $caddyfile; then
    # Caddy logs every step; show them only when something went wrong. A rejected file leaves the old one running.
    for step in validate reload; do
        if ! output=$(docker compose exec -T reverse-proxy caddy "$step" --config /etc/caddy/Caddyfile \
            --adapter caddyfile 2>&1); then
            printf '%s\n' "$output"
            fail "reverse-proxy: caddy $step refused the Caddyfile"
        fi
    done
    log "reverse-proxy: configuration reloaded"
fi

if $keycloak && ! $refresh; then
    log "keycloak: new image; signing in pauses for about a minute while it restarts. Sessions are kept."
    docker compose up --detach --no-deps --wait keycloak
fi

# Other services follow a Compose change only when their own settings changed.
if $stack; then
    docker compose up --detach --no-deps --wait postgres redis keycloak reverse-proxy
fi

echo "$target" >"$state/deployed"
rm -f "$state/rejected"
trap - ERR
docker image prune --force >/dev/null || true

# The public addresses through Caddy on this machine, as a browser would ask for them.
origin=$(env_value PUBLIC_ORIGIN)
if [ "${origin%%://*}" = https ]; then
    host=${origin#https://}
    host=${host%%/*}
    port=$(env_value HTTPS_PORT)
    port=${port:-443}
    for path in / /stream/ /admin/ /api/wiki/v1/regions /idp/realms/wikiaov/.well-known/openid-configuration; do
        if ! curl --fail --silent --show-error --max-time 15 --output /dev/null \
            --resolve "$host:$port:127.0.0.1" "https://$host:$port$path"; then
            log "Now running $short, but $path does not answer through Caddy. Check it, or deploy the previous commit."
            exit 1
        fi
    done
fi
log "Now running $short."
