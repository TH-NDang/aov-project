package com.wikiaov.community.platform;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;

class CommunityJwtAuthenticationConverterTest {
    private static final Map<String, Object> ROLES = Map.of(
            "community-service", Map.of("roles", List.of("tournament:read", "tournament:write")),
            "wiki-service", Map.of("roles", List.of("hero:write")));

    private final CommunityJwtAuthenticationConverter converter = new CommunityJwtAuthenticationConverter(
            List.of("admin-aov-backend"));

    @Test
    void adminTokenCarriesTheCommunityRoles() {
        assertThat(converter.convert(jwt("admin-aov-backend")).getAuthorities())
                .extracting(GrantedAuthority::getAuthority)
                .containsExactlyInAnyOrder("tournament:read", "tournament:write");
    }

    @Test
    void streamTokenSignsInWithoutCapabilities() {
        var authentication = converter.convert(jwt("aov-stream"));

        assertThat(authentication.getAuthorities()).isEmpty();
        assertThat(authentication.getName()).isEqualTo("user-123");
        assertThat(converter.convert(jwt(null)).getAuthorities()).isEmpty();
    }

    @Test
    void tokenWithoutSubjectIsRejected() {
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none").issuer("https://issuer.example")
                .claim("azp", "admin-aov-backend").build();

        assertThatThrownBy(() -> converter.convert(jwt)).isInstanceOf(InvalidBearerTokenException.class);
    }

    private static Jwt jwt(String authorizedParty) {
        var builder = Jwt.withTokenValue("token").header("alg", "none").issuer("https://issuer.example")
                .subject("user-123").claim("resource_access", ROLES);
        if (authorizedParty != null) {
            builder.claim("azp", authorizedParty);
        }
        return builder.build();
    }
}
