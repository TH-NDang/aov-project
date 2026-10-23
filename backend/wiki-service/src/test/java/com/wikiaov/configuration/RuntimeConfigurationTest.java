package com.wikiaov.configuration;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

class RuntimeConfigurationTest {
    @Test
    void findsSharedAndTestSettingsInTheDefaultClasspathConfigDirectory() {
        withProfile("test", environment -> {
            assertThat(environment.getProperty("spring.application.name")).isEqualTo("wiki-service");
            assertThat(environment.getProperty("spring.jpa.hibernate.ddl-auto")).isEqualTo("validate");
            assertThat(environment.getProperty("spring.jpa.open-in-view", Boolean.class)).isFalse();
            assertThat(
                    environment.getProperty("spring.jackson.deserialization.fail-on-unknown-properties", Boolean.class))
                    .isTrue();
            assertThat(environment.getProperty("spring.docker.compose.enabled", Boolean.class)).isFalse();
            assertThat(environment.getProperty("wiki.hero-import.worker-enabled", Boolean.class)).isFalse();
            assertThat(environment.getProperty("spring.security.oauth2.resourceserver.jwt.issuer-uri"))
                    .isEqualTo("http://localhost:0/realms/test");
        });
    }

    @Test
    void localSettingsKeepTheExistingEntryPointAndHonorExportedOverrides() {
        withProfile("local", environment -> {
            assertThat(environment.getProperty("spring.docker.compose.enabled", Boolean.class)).isTrue();
            assertThat(environment.getProperty("spring.docker.compose.file")).isEqualTo("compose.yaml");
            assertThat(environment.getProperty("spring.docker.compose.lifecycle-management")).isEqualTo("start-only");
            assertThat(environment.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://database.example.test:5432/configuration_test");
            assertThat(environment.getProperty("wiki.storage.endpoint")).isEqualTo("http://storage.example.test:8333");
            assertThat(environment.getProperty("wiki.storage.create-bucket-if-missing", Boolean.class)).isTrue();
            assertThat(environment.getProperty("wiki.auth.secure-cookies", Boolean.class)).isFalse();
        });
    }

    @Test
    void productionDoesNotInheritLocalInfrastructureOrCookieOverrides() {
        withProfile("prod", environment -> {
            assertThat(environment.getProperty("logging.structured.format.console")).isEqualTo("ecs");
            assertThat(environment.getProperty("management.endpoint.health.show-details")).isEqualTo("never");
            assertThat(environment.getProperty("spring.docker.compose.enabled", Boolean.class)).isFalse();
            assertThat(environment.getProperty("wiki.storage.create-bucket-if-missing", Boolean.class)).isFalse();
            assertThat(environment.getProperty("wiki.auth.secure-cookies", Boolean.class)).isTrue();
        });
    }

    private static void withProfile(String profile, Consumer<ConfigurableEnvironment> assertions) {
        try (var context = new GenericApplicationContext()) {
            var environment = context.getEnvironment();
            environment.getPropertySources().addFirst(new MapPropertySource("configuration-test", Map.of(
                    "spring.profiles.active", profile,
                    "DB_URL", "jdbc:postgresql://database.example.test:5432/configuration_test",
                    "DB_USERNAME", "configuration_test",
                    "DB_PASSWORD", "test-only",
                    "JWT_ISSUER_URI", "https://identity.example.test/realms/wiki",
                    "STORAGE_ENDPOINT", "http://storage.example.test:8333")));
            new ConfigDataApplicationContextInitializer().initialize(context);
            assertions.accept(environment);
        }
    }
}
