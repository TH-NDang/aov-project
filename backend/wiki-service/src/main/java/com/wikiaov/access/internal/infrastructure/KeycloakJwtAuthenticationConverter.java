package com.wikiaov.access.internal.infrastructure;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.util.StringUtils;

/**
 * Maps {@code resource_access.<client>.roles} of a Keycloak token to authorities named after capabilities,
 * e.g. {@code hero:publish}. Realm roles are ignored: actor roles are composites that Keycloak expands into
 * client roles before issuing the token.
 */
class KeycloakJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {

    private final String resourceClientId;

    KeycloakJwtAuthenticationConverter(String resourceClientId) {
        this.resourceClientId = resourceClientId;
    }

    /** Rejects tokens without a subject: audit identity is {@code (issuer, subject)}. */
    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (!StringUtils.hasText(jwt.getSubject())) {
            throw new InvalidBearerTokenException("Token subject must not be empty");
        }
        return new JwtAuthenticationToken(jwt, authorities(jwt), jwt.getSubject());
    }

    Collection<GrantedAuthority> authorities(Jwt jwt) {
        Map<String, Object> resourceAccess = jwt.getClaimAsMap("resource_access");
        if (resourceAccess == null || !(resourceAccess.get(resourceClientId) instanceof Map<?, ?> client)) {
            return List.of();
        }
        if (!(client.get("roles") instanceof Collection<?> roles)) {
            return List.of();
        }
        return roles.stream()
                .filter(String.class::isInstance)
                .map(role -> (GrantedAuthority) new SimpleGrantedAuthority((String) role))
                .toList();
    }
}
