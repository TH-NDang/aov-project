package com.wikiaov.access.internal.infrastructure;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

class KeycloakJwtAuthenticationConverterTest {

    private final KeycloakJwtAuthenticationConverter converter = new KeycloakJwtAuthenticationConverter("wiki-service");

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
        return Jwt.withTokenValue("token")
                .header("alg", "none")
                .issuer("http://localhost:8081/realms/wikiaov")
                .subject("user-123")
                .claim("resource_access", resourceAccess)
                .build();
    }
}
