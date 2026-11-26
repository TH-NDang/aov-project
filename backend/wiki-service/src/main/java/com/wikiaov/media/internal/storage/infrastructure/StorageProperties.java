package com.wikiaov.media.internal.storage.infrastructure;

import com.wikiaov.media.internal.domain.model.MediaObjectKeys;
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
 * @param bucket                private bucket for incoming uploads and imports
 * @param assetsBucket          optional bucket for validated public assets; empty uses the private bucket
 * @param sourcesBucket         optional private bucket for source files ({@code sources/}); empty uses the private
 *                              bucket (ADR-030)
 * @param pathStyleAccess       {@code true} for SeaweedFS/MinIO ({@code http://host/bucket/key})
 * @param accessKey             access key; empty falls back to the AWS default credentials chain
 * @param secretKey             secret key paired with {@code accessKey}
 * @param createBucketIfMissing create the bucket at startup; meant for local development only
 * @param publicEndpoint        endpoint written into presigned URLs for browsers; empty uses {@code endpoint}
 * @param signUploadSize        sign the declared size into presigned uploads, so that storage refuses a body of another
 *                              length. Off until the storage provider is known to check it (R2 does not document it)
 */
@Validated
@ConfigurationProperties("wiki.storage")
record StorageProperties(
        @Nullable URI endpoint,
        @DefaultValue("us-east-1") @NotBlank String region,
        @DefaultValue("wiki-media") @NotBlank String bucket,
        @Nullable String assetsBucket,
        @Nullable String sourcesBucket,
        @DefaultValue("true") boolean pathStyleAccess,
        @Nullable String accessKey,
        @Nullable String secretKey,
        @DefaultValue("false") boolean createBucketIfMissing,
        @Nullable URI publicEndpoint,
        @DefaultValue("false") boolean signUploadSize
) {

    StorageProperties(@Nullable URI endpoint, String region, String bucket, @Nullable String assetsBucket,
            @Nullable String sourcesBucket, boolean pathStyleAccess, @Nullable String accessKey,
            @Nullable String secretKey, boolean createBucketIfMissing, @Nullable URI publicEndpoint) {
        this(endpoint, region, bucket, assetsBucket, sourcesBucket, pathStyleAccess, accessKey, secretKey,
                createBucketIfMissing, publicEndpoint, false);
    }

    String bucketFor(String key) {
        if (key.startsWith(MediaObjectKeys.ASSETS_PREFIX)) {
            return effectiveAssetsBucket();
        }
        return key.startsWith(MediaObjectKeys.SOURCES_PREFIX) ? effectiveSourcesBucket() : bucket;
    }

    String effectiveAssetsBucket() {
        return assetsBucket == null || assetsBucket.isBlank() ? bucket : assetsBucket;
    }

    String effectiveSourcesBucket() {
        return sourcesBucket == null || sourcesBucket.isBlank() ? bucket : sourcesBucket;
    }

    @Nullable
    URI presignEndpoint() {
        return publicEndpoint != null ? publicEndpoint : endpoint;
    }

    boolean hasStaticCredentials() {
        return accessKey != null && !accessKey.isBlank() && secretKey != null && !secretKey.isBlank();
    }
}
