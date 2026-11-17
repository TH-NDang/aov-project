package com.wikiaov;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import org.testcontainers.junit.jupiter.Testcontainers;

/**
 * The one Docker gate of the suite: marks a {@code *IntegrationTest} that needs containers. Where Docker is missing
 * the test is reported as skipped instead of failing; CI has Docker, so there it always runs. PostgreSQL comes from
 * {@link TestcontainersConfiguration}, object storage from {@link SeaweedFsTestConfiguration}.
 */
@Documented
@Retention(RetentionPolicy.RUNTIME)
@Target(ElementType.TYPE)
@Testcontainers(disabledWithoutDocker = true)
public @interface DockerBacked {
}
