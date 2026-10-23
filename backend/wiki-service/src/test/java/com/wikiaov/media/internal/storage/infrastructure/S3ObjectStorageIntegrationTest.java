package com.wikiaov.media.internal.storage.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.storage.application.port.PresignedRequest;
import com.wikiaov.platform.ApiException;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

/**
 * Exercises the adapter against a real S3-compatible server (SeaweedFS, the same image as compose.yaml).
 * SeaweedFS verifies request signatures, so the security cases below are meaningful. Requires Docker.
 */
@Testcontainers(disabledWithoutDocker = true)
class S3ObjectStorageIntegrationTest {

    private static final String ACCESS_KEY = "test-access";
    private static final String SECRET_KEY = "test-secret";
    private static final String S3_CONFIG = """
            {"identities": [{"name": "test",
              "credentials": [{"accessKey": "%s", "secretKey": "%s"}],
              "actions": ["Admin", "Read", "Write", "List", "Tagging"]}]}
            """.formatted(ACCESS_KEY, SECRET_KEY);

    // The builder methods return the same container; the extension starts and stops it,
    // so the compiler's resource-leak analysis is a false positive here.
    @SuppressWarnings("resource")
    @Container
    static final GenericContainer<?> SEAWEEDFS = new GenericContainer<>("chrislusf/seaweedfs:4.48")
            .withCommand("server", "-dir=/data", "-s3", "-s3.port=8333", "-s3.config=/etc/seaweedfs/s3.json")
            .withCopyToContainer(Transferable.of(S3_CONFIG), "/etc/seaweedfs/s3.json")
            .withExposedPorts(8333)
            // The S3 API answers anonymous requests with 403 once it is ready.
            .waitingFor(Wait.forHttp("/").forPort(8333).forStatusCode(403)
                    .withStartupTimeout(Duration.ofMinutes(2)));

    private static URI endpoint;
    private static S3Client s3;
    private static S3Presigner presigner;
    private static S3ObjectStorage storage;

    @BeforeAll
    static void setUp() {
        endpoint = URI.create("http://" + SEAWEEDFS.getHost() + ":" + SEAWEEDFS.getMappedPort(8333));
        StorageProperties properties = properties(SECRET_KEY);
        S3StorageConfiguration configuration = new S3StorageConfiguration();
        s3 = configuration.s3Client(properties);
        presigner = configuration.s3Presigner(properties);
        s3.createBucket(request -> request.bucket(properties.bucket()));
        storage = new S3ObjectStorage(s3, presigner, properties);
    }

    @AfterAll
    static void tearDown() {
        // In the application these beans are closed by Spring; here the test owns them.
        if (presigner != null) {
            presigner.close();
        }
        if (s3 != null) {
            s3.close();
        }
    }

    @Test
    void putStatOpenAndDelete() throws Exception {
        byte[] bytes = "portrait-bytes".getBytes(StandardCharsets.UTF_8);
        storage.put("assets/a1/v1.webp", new ByteArrayInputStream(bytes), bytes.length, "image/webp");

        assertThat(storage.stat("assets/a1/v1.webp")).hasValueSatisfying(object -> {
            assertThat(object.sizeBytes()).isEqualTo(bytes.length);
            assertThat(object.contentType()).isEqualTo("image/webp");
        });
        try (InputStream in = storage.open("assets/a1/v1.webp")) {
            assertThat(in.readAllBytes()).isEqualTo(bytes);
        }

        storage.delete("assets/a1/v1.webp");
        storage.delete("assets/a1/v1.webp");
        assertThat(storage.stat("assets/a1/v1.webp")).isEmpty();
    }

    @Test
    void missingObjectIsReportedAsNotFound() {
        assertThat(storage.stat("assets/missing.png")).isEmpty();
        assertThatThrownBy(() -> storage.open("assets/missing.png"))
                .isInstanceOfSatisfying(ApiException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(MediaErrorCode.MEDIA_OBJECT_NOT_FOUND));
    }

    @Test
    void copyKeepsOriginal() {
        byte[] bytes = {1, 2, 3};
        storage.put("incoming/u1", new ByteArrayInputStream(bytes), bytes.length, "image/png");

        storage.copy("incoming/u1", "assets/a2/v1.png", "image/png", "public, max-age=31536000, immutable");

        assertThat(storage.stat("assets/a2/v1.png"))
                .hasValueSatisfying(object -> assertThat(object.contentType()).isEqualTo("image/png"));
        assertThat(storage.stat("incoming/u1")).isPresent();
    }

    @Test
    void presignedUploadAndDownloadWorkWithoutCredentials() throws Exception {
        byte[] bytes = "uploaded-directly".getBytes(StandardCharsets.UTF_8);
        try (HttpClient http = HttpClient.newHttpClient()) {
            PresignedRequest upload = storage.presignPut("incoming/u2", "image/png", Duration.ofMinutes(5));
            HttpRequest.Builder put = HttpRequest.newBuilder(upload.url())
                    .method(upload.method(), HttpRequest.BodyPublishers.ofByteArray(bytes));
            upload.headers().forEach(put::header);
            assertThat(http.send(put.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);

            PresignedRequest download = storage.presignGet("incoming/u2", Duration.ofMinutes(5));
            HttpResponse<byte[]> response = http.send(HttpRequest.newBuilder(download.url()).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo(bytes);
        }
    }

    @Test
    void presignedUploadWithDifferentContentTypeIsRejected() throws Exception {
        PresignedRequest upload = storage.presignPut("incoming/u3", "image/png", Duration.ofMinutes(5));
        HttpRequest tampered = HttpRequest.newBuilder(upload.url())
                .method(upload.method(), HttpRequest.BodyPublishers.ofByteArray(new byte[] {1}))
                .header("Content-Type", "image/jpeg")
                .build();

        try (HttpClient http = HttpClient.newHttpClient()) {
            int status = http.send(tampered, HttpResponse.BodyHandlers.discarding()).statusCode();

            assertThat(status).isEqualTo(403);
        }
    }

    @Test
    void separateBucketsKeepStagingPrivateAndCopyImmutableAssets() throws Exception {
        String publicBucket = "wiki-media-assets-test";
        s3.createBucket(request -> request.bucket(publicBucket));
        var properties = new StorageProperties(endpoint, "us-east-1", "wiki-media-test", publicBucket,
                true, ACCESS_KEY, SECRET_KEY, false);
        var splitStorage = new S3ObjectStorage(s3, presigner, properties);
        byte[] bytes = "split-bucket-image".getBytes(StandardCharsets.UTF_8);
        String source = "incoming/split-upload";
        String target = "assets/split/version.png";
        String cacheControl = "public, max-age=31536000, immutable";

        try (HttpClient http = HttpClient.newHttpClient()) {
            PresignedRequest upload = splitStorage.presignPut(source, "image/png", Duration.ofMinutes(5));
            HttpRequest.Builder put = HttpRequest.newBuilder(upload.url())
                    .method(upload.method(), HttpRequest.BodyPublishers.ofByteArray(bytes));
            upload.headers().forEach(put::header);
            assertThat(http.send(put.build(), HttpResponse.BodyHandlers.discarding()).statusCode()).isEqualTo(200);

            splitStorage.copy(source, target, "image/png", cacheControl);
            var head = s3.headObject(request -> request.bucket(publicBucket).key(target));
            assertThat(head.cacheControl()).isEqualTo(cacheControl);
            assertThat(head.contentType()).isEqualTo("image/png");
            assertThatThrownBy(() -> s3.headObject(request -> request.bucket(publicBucket).key(source)))
                    .isInstanceOf(S3Exception.class);
            assertThatThrownBy(() -> s3.headObject(request -> request.bucket(properties.bucket()).key(target)))
                    .isInstanceOf(S3Exception.class);

            PresignedRequest download = splitStorage.presignGet(target, Duration.ofMinutes(5));
            var response = http.send(HttpRequest.newBuilder(download.url()).GET().build(),
                    HttpResponse.BodyHandlers.ofByteArray());
            assertThat(response.statusCode()).isEqualTo(200);
            assertThat(response.body()).isEqualTo(bytes);
        }

        assertThat(splitStorage.stat(source)).isPresent();
        try (InputStream stream = splitStorage.open(target)) {
            assertThat(stream.readAllBytes()).isEqualTo(bytes);
        }
        splitStorage.delete(target);
        assertThat(splitStorage.stat(target)).isEmpty();
        assertThat(splitStorage.stat(source)).isPresent();
    }

    @Test
    void wrongSecretKeyIsRejected() {
        try (S3Client wrongKey = new S3StorageConfiguration().s3Client(properties("wrong-secret"))) {
            assertThatThrownBy(wrongKey::listBuckets).isInstanceOf(S3Exception.class);
        }
    }

    private static StorageProperties properties(String secretKey) {
        return new StorageProperties(endpoint, "us-east-1", "wiki-media-test", null, true, ACCESS_KEY, secretKey,
                false);
    }
}
