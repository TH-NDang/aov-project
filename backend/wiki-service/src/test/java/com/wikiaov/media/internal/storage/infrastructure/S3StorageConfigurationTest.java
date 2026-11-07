package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.time.Duration;
import org.junit.jupiter.api.Test;

class S3StorageConfigurationTest {

    @Test
    void presignedUrlsUseThePublicEndpointWhenStorageIsOnAPrivateNetwork() {
        var properties = properties(URI.create("http://seaweedfs:8333"), URI.create("https://wiki.example.test"));

        try (var presigner = new S3StorageConfiguration().s3Presigner(properties)) {
            var url = presigner.presignPutObject(request -> request
                    .signatureDuration(Duration.ofMinutes(15))
                    .putObjectRequest(put -> put.bucket("wiki-media").key("incoming/upload")))
                    .url();

            assertThat(url.getProtocol()).isEqualTo("https");
            assertThat(url.getHost()).isEqualTo("wiki.example.test");
            assertThat(url.getPath()).isEqualTo("/wiki-media/incoming/upload");
        }
    }

    @Test
    void presignedUrlsFollowTheStorageEndpointWithoutAPublicOne() {
        var properties = properties(URI.create("http://localhost:8333"), null);

        try (var presigner = new S3StorageConfiguration().s3Presigner(properties)) {
            var url = presigner.presignGetObject(request -> request
                    .signatureDuration(Duration.ofMinutes(15))
                    .getObjectRequest(get -> get.bucket("wiki-media").key("assets/a/b.png")))
                    .url();

            assertThat(url.getHost()).isEqualTo("localhost");
            assertThat(url.getPort()).isEqualTo(8333);
        }
    }

    private static StorageProperties properties(URI endpoint, URI publicEndpoint) {
        return new StorageProperties(endpoint, "us-east-1", "wiki-media", null, true, "key", "secret", false,
                publicEndpoint);
    }
}
