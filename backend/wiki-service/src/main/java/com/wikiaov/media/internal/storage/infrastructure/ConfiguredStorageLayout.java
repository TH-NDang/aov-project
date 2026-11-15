package com.wikiaov.media.internal.storage.infrastructure;

import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
import com.wikiaov.media.internal.storage.application.port.StorageLayout;
import org.springframework.stereotype.Component;

/** Bucket names as {@link S3ObjectStorage} routes keys, read from {@code wiki.storage.*}. */
@Component
class ConfiguredStorageLayout implements StorageLayout {

    private final StorageProperties properties;

    ConfiguredStorageLayout(StorageProperties properties) {
        this.properties = properties;
    }

    @Override
    public String assetsBucket() {
        return properties.bucketFor(MediaObjectKeys.ASSETS_PREFIX);
    }

    @Override
    public String sourcesBucket() {
        return properties.bucketFor(MediaObjectKeys.SOURCES_PREFIX);
    }

    @Override
    public String stagingBucket() {
        return properties.bucketFor(MediaObjectKeys.INCOMING_PREFIX);
    }
}
