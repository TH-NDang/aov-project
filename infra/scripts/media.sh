#!/bin/sh
# Object storage tasks through the S3 API, so they work the same on SeaweedFS and on a hosted service.
#   media.sh init     creates the buckets when missing
#   media.sh backup   copies new objects to backups/media/; never deletes from the backup
#   media.sh restore  copies the backup back; never deletes from storage
# Keys are immutable and incoming/ only holds uploads waiting for validation, so it is left out.
set -eu

buckets=$STORAGE_BUCKET
if [ -n "${STORAGE_ASSETS_BUCKET:-}" ] && [ "$STORAGE_ASSETS_BUCKET" != "$STORAGE_BUCKET" ]; then
    buckets="$buckets $STORAGE_ASSETS_BUCKET"
fi

for bucket in $buckets; do
    case "${1:-}" in
        init)
            rclone mkdir "store:$bucket"
            echo "Bucket ready: $bucket"
            ;;
        backup)
            rclone copy "store:$bucket" "/backups/media/$bucket" --exclude 'incoming/**' --stats-one-line
            echo "Media backup updated: backups/media/$bucket"
            ;;
        restore)
            # Object metadata is not kept on disk; the type comes from the extension, the cache rule is set again.
            rclone copy "/backups/media/$bucket/assets" "store:$bucket/assets" --stats-one-line \
                --header-upload 'Cache-Control: public, max-age=31536000, immutable'
            if [ -d "/backups/media/$bucket/imports" ]; then
                rclone copy "/backups/media/$bucket/imports" "store:$bucket/imports" --stats-one-line
            fi
            echo "Media restored into: $bucket"
            ;;
        *)
            echo "Usage: media.sh init|backup|restore" >&2
            exit 2
            ;;
    esac
done
