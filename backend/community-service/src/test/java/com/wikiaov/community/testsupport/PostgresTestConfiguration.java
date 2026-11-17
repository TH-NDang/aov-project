package com.wikiaov.community.testsupport;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The PostgreSQL every integration test runs on. Application tests get it through
 * {@link CommunityApplicationTest}; a test that drives Flyway by hand starts its own with {@link #create()}.
 */
@TestConfiguration(proxyBeanMethods = false)
public class PostgresTestConfiguration {
    public static final String IMAGE = "postgres:17.6";

    public static PostgreSQLContainer create() {
        return new PostgreSQLContainer(DockerImageName.parse(IMAGE));
    }

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgres() {
        return create();
    }
}
