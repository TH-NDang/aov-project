#!/bin/sh
# Copies the Cloudflare R2 buckets to backups/media/ and back, through the S3 API (ADR-021, ADR-030).
#   media.sh backup   downloads the objects missing from backups/media/; never deletes or rewrites a backup file
#   media.sh restore  uploads the backup files missing from the buckets; never deletes or overwrites an object
# Every key is written once (assets/<asset>/<version>.<ext>, sources/<sha256>), so a file that exists already is
# skipped without being read again. incoming/ only holds uploads waiting for validation and is left out.
set -eu

: "${STORAGE_BUCKET:?is missing in .env}"
: "${STORAGE_ASSETS_BUCKET:?is missing in .env}"
: "${STORAGE_SOURCES_BUCKET:?is missing in .env}"

backups=/backups/media
sources="$backups/$STORAGE_SOURCES_BUCKET"
# Source files have no extension, so their Content-Type is kept beside the copy, one "<key><TAB><type>" per line.
types="$backups/$STORAGE_SOURCES_BUCKET.types"
tab=$(printf '\t')
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# Recursive listings cost one class A operation per 1,000 keys instead of one per folder.
copy() {
    rclone copy "$@" --ignore-existing --fast-list --stats-one-line
}

# Keys under sources/ that have a backup file but no line in the type list given as $1.
untyped_sources() {
    (cd "$sources" && find sources -type f ! -name '*.partial') | sort > "$work/files"
    cut -f1 "$1" | sort > "$work/typed"
    comm -23 "$work/files" "$work/typed"
}

backup() {
    for bucket in $(printf '%s\n' "$STORAGE_BUCKET" "$STORAGE_ASSETS_BUCKET" "$STORAGE_SOURCES_BUCKET" | sort -u); do
        mkdir -p "$backups/$bucket"
        copy "store:$bucket" "$backups/$bucket" --exclude 'incoming/**'
        echo "Media backup updated: backups/media/$bucket"
    done

    touch "$types"
    if [ -d "$sources/sources" ]; then
        untyped_sources "$types" > "$work/new"
        # One HEAD request per new file; types already recorded are not asked again. A key deleted since is skipped.
        if [ -s "$work/new" ]; then
            rclone lsf -R "store:$STORAGE_SOURCES_BUCKET" --files-from "$work/new" --files-only --format pm \
                --separator "$tab" >> "$types"
        fi
    fi
    echo "Content types recorded for $(wc -l < "$types") source files: backups/media/$STORAGE_SOURCES_BUCKET.types"
}

# Uploads one prefix of a bucket from its backup folder; further arguments go to rclone.
restore_prefix() {
    bucket=$1
    prefix=$2
    shift 2
    if [ ! -d "$backups/$bucket/$prefix" ]; then
        echo "Nothing to restore in backups/media/$bucket/$prefix"
        return 0
    fi
    copy "$backups/$bucket/$prefix" "store:$bucket/$prefix" "$@"
    echo "Restored: $bucket/$prefix"
}

restore_sources() {
    if [ ! -d "$sources/sources" ]; then
        echo "Nothing to restore in backups/media/$STORAGE_SOURCES_BUCKET/sources"
        return 0
    fi
    list=$types
    if [ ! -f "$list" ]; then
        list="$work/no-types"
        : > "$list"
    fi
    cache='Cache-Control: private, max-age=31536000, immutable'

    # Each Content-Type goes up as one group, with the headers SourceUploads writes.
    cut -f2 "$list" | sort -u > "$work/kinds"
    while IFS= read -r kind; do
        awk -F "$tab" -v kind="$kind" '$2 == kind { print $1 }' "$list" > "$work/group"
        copy "$sources" "store:$STORAGE_SOURCES_BUCKET" --files-from "$work/group" \
            --header-upload "Content-Type: $kind" --header-upload "$cache"
    done < "$work/kinds"

    untyped_sources "$list" > "$work/untyped"
    if [ -s "$work/untyped" ]; then
        echo "No recorded type for $(wc -l < "$work/untyped") source files; they go back as application/octet-stream." >&2
        copy "$sources" "store:$STORAGE_SOURCES_BUCKET" --files-from "$work/untyped" --header-upload "$cache"
    fi
    echo "Restored: $STORAGE_SOURCES_BUCKET/sources"
}

case "${1:-}" in
    backup)
        backup
        ;;
    restore)
        # The type comes from the extension; the cache rule is the one MediaIngestion writes.
        restore_prefix "$STORAGE_ASSETS_BUCKET" assets \
            --header-upload 'Cache-Control: public, max-age=31536000, immutable'
        restore_prefix "$STORAGE_BUCKET" imports
        restore_sources
        ;;
    *)
        echo "Usage: media.sh backup|restore" >&2
        exit 2
        ;;
esac
