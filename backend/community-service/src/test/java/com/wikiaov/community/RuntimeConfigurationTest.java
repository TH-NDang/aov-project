package com.wikiaov.community;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.context.support.GenericApplicationContext;
import org.springframework.core.env.MapPropertySource;

class RuntimeConfigurationTest {
    @Test
    void productionRequiresDeploymentValuesInsteadOfLocalDefaults() {
        try (var context = withProfile("prod", Map.of())) {
            var environment = context.getEnvironment();

            for (String property : List.of("spring.datasource.url", "spring.datasource.username",
                    "spring.datasource.password", "spring.security.oauth2.resourceserver.jwt.issuer-uri",
                    "spring.security.oauth2.resourceserver.jwt.jwk-set-uri", "community.wiki-base-url",
                    "community.allowed-origins")) {
                assertThatThrownBy(() -> environment.getProperty(property))
                        .as(property).isInstanceOf(IllegalArgumentException.class);
            }
            assertThat(environment.getProperty("logging.structured.format.console")).isEqualTo("ecs");
            assertThat(environment.getProperty("management.endpoint.health.show-details")).isEqualTo("never");
            assertThat(environment.getProperty("server.forward-headers-strategy")).isEqualTo("native");
        }
    }

    @Test
    void productionUsesTheValuesItIsGiven() {
        var values = Map.<String, Object>of(
                "COMMUNITY_DATABASE_URL", "jdbc:postgresql://database.example.test:5432/community",
                "KEYCLOAK_ISSUER", "https://wiki.example.test/idp/realms/wikiaov",
                "KEYCLOAK_JWK_SET_URI", "http://keycloak:8080/idp/realms/wikiaov/protocol/openid-connect/certs");

        try (var context = withProfile("prod", values)) {
            var environment = context.getEnvironment();

            assertThat(environment.getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://database.example.test:5432/community");
            assertThat(environment.getProperty("spring.security.oauth2.resourceserver.jwt.issuer-uri"))
                    .isEqualTo("https://wiki.example.test/idp/realms/wikiaov");
        }
    }

    @Test
    void localDevelopmentKeepsItsDefaults() {
        try (var context = withProfile("default", Map.of())) {
            assertThat(context.getEnvironment().getProperty("spring.datasource.url"))
                    .isEqualTo("jdbc:postgresql://localhost:5432/community");
        }
    }

    private static GenericApplicationContext withProfile(String profile, Map<String, Object> values) {
        var context = new GenericApplicationContext();
        var sources = context.getEnvironment().getPropertySources();
        sources.addFirst(new MapPropertySource("profile", Map.of("spring.profiles.active", profile)));
        sources.addFirst(new MapPropertySource("values", values));
        new ConfigDataApplicationContextInitializer().initialize(context);
        return context;
    }
}
