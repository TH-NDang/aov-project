package com.wikiaov.community.platform;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.convert.converter.Converter;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Maps {@code resource_access.community-service.roles} of a Keycloak token to authorities.
 *
 * <p>Only tokens issued to a capability client ({@code azp}) carry capabilities. Stream shares the origin with user
 * content; a script injected there must not be able to act as a staff member who signed in to it.
 */
final class CommunityJwtAuthenticationConverter implements Converter<Jwt, AbstractAuthenticationToken> {
    private static final String RESOURCE_CLIENT = "community-service";

    private final Set<String> capabilityClients;

    CommunityJwtAuthenticationConverter(Collection<String> capabilityClients) {
        this.capabilityClients = Set.copyOf(capabilityClients);
    }

    @Override
    public AbstractAuthenticationToken convert(Jwt jwt) {
        if (jwt.getSubject() == null || jwt.getSubject().isBlank()) {
            throw new InvalidBearerTokenException("Token subject is required");
        }
        return new JwtAuthenticationToken(jwt, authorities(jwt), jwt.getSubject());
    }

    Collection<GrantedAuthority> authorities(Jwt jwt) {
        String authorizedParty = jwt.getClaimAsString("azp");
        if (authorizedParty == null || !capabilityClients.contains(authorizedParty)) {
            return List.of();
        }
        Map<String, Object> resources = jwt.getClaimAsMap("resource_access");
        Object client = resources == null ? null : resources.get(RESOURCE_CLIENT);
        Object roles = client instanceof Map<?, ?> map ? map.get("roles") : null;
        if (!(roles instanceof Collection<?> values)) {
            return List.of();
        }
        return values.stream().filter(String.class::isInstance)
                .map(role -> (GrantedAuthority) new SimpleGrantedAuthority((String) role)).toList();
    }
}
