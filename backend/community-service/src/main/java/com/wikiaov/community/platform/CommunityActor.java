package com.wikiaov.community.platform;

import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public record CommunityActor(
        String key,
        String name,
        Set<String> capabilities
) {
    public static CommunityActor require() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token)
                || token.getToken().hasClaim("client_id") || token.getToken().getSubject() == null)
            throw new AccessDeniedException("A human account is required.");

        var jwt = token.getToken();
        String name = jwt.getClaimAsString("name");
        if (name == null || name.isBlank())
            name = jwt.getClaimAsString("preferred_username");
        return new CommunityActor(jwt.getIssuer() + "\n" + jwt.getSubject(),
                name == null ? "Member" : name,
                token.getAuthorities().stream().map(Object::toString).collect(Collectors.toUnmodifiableSet()));
    }

    public boolean editor() {
        return capabilities.contains("tournament:read") && capabilities.contains("tournament:write");
    }

    public boolean publisher() {
        return capabilities.contains("tournament:read") && capabilities.contains("tournament:publish");
    }
}
