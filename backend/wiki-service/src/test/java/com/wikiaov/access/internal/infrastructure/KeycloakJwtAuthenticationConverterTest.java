package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

class KeycloakJwtAuthenticationConverterTest {

    private final KeycloakJwtAuthenticationConverter converter = new KeycloakJwtAuthenticationConverter("wiki-service",
            Set.of("admin-aov-backend", "wiki-importer"));

    @Test
    void readsOnlyClientRolesOfTheConfiguredClient() {
        Jwt jwt = jwt(Map.of(
                "wiki-service", Map.of("roles", List.of("catalog:read", "hero:write")),
                "account", Map.of("roles", List.of("manage-account"))));

        assertThat(converter.convert(jwt).getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("catalog:read", "hero:write");
    }

    @Test
    void tokenOfAPublicClientHasNoAuthorities() {
        var roles = Map.<String, Object>of("wiki-service", Map.of("roles", List.of("catalog:read", "hero:publish")));

        assertThat(converter.convert(jwt(roles, "aov-wiki")).getAuthorities()).isEmpty();
        assertThat(converter.convert(jwt(roles, "aov-stream")).getAuthorities()).isEmpty();
        assertThat(converter.convert(jwt(roles, null)).getAuthorities()).isEmpty();
        assertThat(converter.convert(jwt(roles, "aov-wiki")).getName()).isEqualTo("user-123");
    }

    @Test
    void serviceAccountOfACapabilityClientKeepsItsRoles() {
        var roles = Map.<String, Object>of("wiki-service", Map.of("roles", List.of("hero:write")));

        assertThat(converter.convert(jwt(roles, "wiki-importer")).getAuthorities())
                .extracting(GrantedAuthority::getAuthority).containsExactly("hero:write");
    }

    @Test
    void tokenWithoutClientRolesHasNoAuthorities() {
        assertThat(converter.convert(jwt(Map.of())).getAuthorities()).isEmpty();
        assertThat(converter.convert(jwt(Map.of("wiki-service", Map.of()))).getAuthorities()).isEmpty();
    }

    @Test
    void tokenWithoutSubjectIsRejected() {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none")
                .issuer("http://localhost:8081/realms/wikiaov").claim("scope", "x").build();

        assertThatThrownBy(() -> converter.convert(jwt)).isInstanceOf(InvalidBearerTokenException.class);
    }

    @Test
    void principalNameIsTheSubject() {
        assertThat(converter.convert(jwt(Map.of())).getName()).isEqualTo("user-123");
    }

    private static Jwt jwt(Map<String, Object> resourceAccess) {
        return jwt(resourceAccess, "admin-aov-backend");
    }

    private static Jwt jwt(Map<String, Object> resourceAccess, String authorizedParty) {
        var builder = Jwt.withTokenValue("token")
                .header("alg", "none")
                .issuer("http://localhost:8081/realms/wikiaov")
                .subject("user-123")
                .claim("resource_access", resourceAccess);
        if (authorizedParty != null) {
            builder.claim("azp", authorizedParty);
        }
        return builder.build();
    }
}
