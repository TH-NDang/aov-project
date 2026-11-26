package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class S3ObjectStoragePresignTest {

    @Test
    void signedUploadSizeIsPartOfTheSignatureButNotOfTheHeadersToSend() {
        var properties = properties(true);
        var configuration = new S3StorageConfiguration();

        try (var s3 = configuration.s3Client(properties); var presigner = configuration.s3Presigner(properties)) {
            var upload = new S3ObjectStorage(s3, presigner, properties)
                    .presignPut("incoming/upload", "image/png", 1234, Duration.ofMinutes(15));

            assertThat(upload.url().getQuery()).contains("X-Amz-SignedHeaders=content-length;content-type;host");
            assertThat(upload.headers()).containsEntry("content-type", "image/png")
                    .doesNotContainKeys("Content-Length", "content-length", "Host", "host");
        }
    }

    @Test
    void uploadSizeStaysUnsignedUntilEnabled() {
        var properties = properties(false);
        var configuration = new S3StorageConfiguration();

        try (var s3 = configuration.s3Client(properties); var presigner = configuration.s3Presigner(properties)) {
            var upload = new S3ObjectStorage(s3, presigner, properties)
                    .presignPut("incoming/upload", "image/png", 1234, Duration.ofMinutes(15));

            assertThat(upload.url().getQuery()).contains("X-Amz-SignedHeaders=content-type;host");
        }
    }

    private static StorageProperties properties(boolean signUploadSize) {
        return new StorageProperties(URI.create("http://localhost:8333"), "us-east-1", "wiki-media", null, null, true,
                "key", "secret", false, null, signUploadSize);
    }
}
