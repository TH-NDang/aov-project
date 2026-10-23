package com.wikiaov.media.internal.storage.infrastructure;

import jakarta.validation.constraints.NotBlank;
import java.net.URI;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Connection settings for the S3-compatible object storage.
 *
 * @param endpoint              custom endpoint (SeaweedFS, R2); empty means the AWS S3 default
 * @param region                signing region; SeaweedFS accepts any value, R2 uses {@code auto}
 * @param bucket                bucket that holds media objects
 * @param pathStyleAccess       {@code true} for SeaweedFS/MinIO ({@code http://host/bucket/key})
 * @param accessKey             access key; empty falls back to the AWS default credentials chain
 * @param secretKey             secret key paired with {@code accessKey}
 * @param createBucketIfMissing create the bucket at startup; meant for local development only
 */
@Validated
@ConfigurationProperties("wiki.storage")
record StorageProperties(
        @Nullable URI endpoint,
        @DefaultValue("us-east-1") @NotBlank String region,
        @DefaultValue("wiki-media") @NotBlank String bucket,
        @DefaultValue("true") boolean pathStyleAccess,
        @Nullable String accessKey,
        @Nullable String secretKey,
        @DefaultValue("false") boolean createBucketIfMissing
) {

    boolean hasStaticCredentials() {
        return accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank();
    }
}
