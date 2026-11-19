#!/bin/sh
# Copies the database dumps in backups/db/ to the offsite bucket on R2 (ADR-021, addendum of 19/11/2026 on alerts and
# offsite backups). scheduled.sh backup runs it after the nightly dump: docker compose run --rm db-offsite
# A dump folder is written once and never changes, so a file that is there already is skipped. Nothing is ever deleted
# from the bucket: its lifecycle rule expires old dumps. Folders still being written and dev exports are left out.
set -eu

: "${OFFSITE_BUCKET:?is missing in .env}"

rclone copy /backups/db "offsite:$OFFSITE_BUCKET/db" --ignore-existing --fast-list --stats-one-line \
    --exclude '*.partial/**' --exclude 'dev-*/**'
echo "Offsite copy updated: $OFFSITE_BUCKET/db"
