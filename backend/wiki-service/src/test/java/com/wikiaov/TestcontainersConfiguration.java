package com.wikiaov;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.postgresql.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * The one PostgreSQL setup of the suite. Spring tests import this configuration; migration tests that drive Flyway
 * by hand start {@link #postgres()} themselves. Public so tests in module packages can use it.
 */
@TestConfiguration(proxyBeanMethods = false)
public class TestcontainersConfiguration {
    private static final DockerImageName POSTGRES = DockerImageName.parse("postgres:17.6");

    /** A new, not yet started PostgreSQL container of the version production runs. */
    public static PostgreSQLContainer postgres() {
        return new PostgreSQLContainer(POSTGRES);
    }

    @Bean
    @ServiceConnection
    PostgreSQLContainer postgresContainer() {
        return postgres();
    }

}
