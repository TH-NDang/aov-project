package com.wikiaov;

import java.time.Duration;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.test.context.DynamicPropertyRegistrar;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.Transferable;

/** S3-compatible object storage for integration tests: the same SeaweedFS image as compose.yaml. */
@TestConfiguration(proxyBeanMethods = false)
public class SeaweedFsTestConfiguration {

    public static final String ACCESS_KEY = "test-access";
    public static final String SECRET_KEY = "test-secret";
    private static final String S3_CONFIG = """
            {"identities": [{"name": "test",
              "credentials": [{"accessKey": "%s", "secretKey": "%s"}],
              "actions": ["Admin", "Read", "Write", "List", "Tagging"]}]}
            """.formatted(ACCESS_KEY, SECRET_KEY);

    /** A new, not yet started SeaweedFS server that accepts {@link #ACCESS_KEY} and {@link #SECRET_KEY}. */
    // The builder methods return the same container; its owner starts and stops it.
    @SuppressWarnings("resource")
    public static GenericContainer<?> seaweedFs() {
        return new GenericContainer<>("chrislusf/seaweedfs:4.48")
                .withCommand("server", "-dir=/data", "-s3", "-s3.port=8333", "-s3.config=/etc/seaweedfs/s3.json")
                .withCopyToContainer(Transferable.of(S3_CONFIG), "/etc/seaweedfs/s3.json")
                .withExposedPorts(8333)
                // The S3 API answers anonymous requests with 403 once it is ready.
                .waitingFor(Wait.forHttp("/").forPort(8333).forStatusCode(403)
                        .withStartupTimeout(Duration.ofMinutes(2)));
    }

    // Started and stopped by Spring Boot's Testcontainers support, not by the caller.
    @Bean
    GenericContainer<?> seaweedFsContainer() {
        return seaweedFs();
    }

    @Bean
    DynamicPropertyRegistrar seaweedFsProperties(GenericContainer<?> seaweedFsContainer) {
        return registry -> {
            registry.add("wiki.storage.endpoint",
                    () -> "http://" + seaweedFsContainer.getHost() + ":" + seaweedFsContainer.getMappedPort(8333));
            registry.add("wiki.storage.access-key", () -> ACCESS_KEY);
            registry.add("wiki.storage.secret-key", () -> SECRET_KEY);
            registry.add("wiki.storage.create-bucket-if-missing", () -> "true");
        };
    }
}
