package com.wikiaov.media.internal.capacity.domain;

import org.jspecify.annotations.Nullable;

/** The storage figure the report leads with, and whether it is Cloudflare's. */
public record StorageReading(
        long bytes,
        boolean fromCloudflare
) {

    /**
     * Cloudflare also counts bytes the catalog does not, such as abandoned uploads, but refreshes storage only every so
     * often, so a batch uploaded within the hour is missing from it. The larger figure counts both and warns early.
     */
    public static StorageReading of(long databaseBytes, @Nullable Long cloudflareBytes) {
        return cloudflareBytes != null && cloudflareBytes > databaseBytes
                ? new StorageReading(cloudflareBytes, true)
                : new StorageReading(databaseBytes, false);
    }
}
