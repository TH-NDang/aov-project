package com.wikiaov.community.platform;

import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * The account behind a request. Its {@code key} is the one form every table stores for an account: the token's
 * issuer and subject on two lines. Only this class builds it.
 */
public record CommunityActor(
        String key,
        String name,
        Set<String> capabilities
) {
    /** The person signed in; service accounts and anonymous requests are refused. */
    public static CommunityActor require() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token)
                || token.getToken().hasClaim("client_id") || token.getToken().getSubject() == null) {
            throw new AccessDeniedException("A human account is required.");
        }

        var jwt = token.getToken();
        String name = jwt.getClaimAsString("name");
        if (name == null || name.isBlank()) {
            name = jwt.getClaimAsString("preferred_username");
        }
        return new CommunityActor(key(jwt), name == null ? "Member" : name,
                token.getAuthorities().stream().map(Object::toString).collect(Collectors.toUnmodifiableSet()));
    }

    /**
     * The key of whoever edits a registry record. Unlike {@link #require()} it accepts service accounts, which may
     * write tournament records with the right capabilities.
     */
    public static String editorKey() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (!(authentication instanceof JwtAuthenticationToken token)) {
            throw new AccessDeniedException("A signed-in account is required.");
        }

        return key(token.getToken());
    }

    private static String key(Jwt jwt) {
        return jwt.getIssuer() + "\n" + jwt.getSubject();
    }

    public boolean editor() {
        return capabilities.contains("tournament:read") && capabilities.contains("tournament:write");
    }

    public boolean publisher() {
        return capabilities.contains("tournament:read") && capabilities.contains("tournament:publish");
    }
}
