package com.wikiaov.access.internal.application;

import com.wikiaov.access.Capabilities;
import com.wikiaov.access.internal.application.port.IdentityTokens;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PlatformErrorCode;
import java.util.Collection;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.stereotype.Service;

@Service
public class AuthSessions {
    private final IdentityTokens identity;
    private final JwtDecoder decoder;
    private final String resourceClientId;

    public AuthSessions(IdentityTokens identity, JwtDecoder decoder,
            @Value("${wiki.security.resource-client-id:wiki-service}") String resourceClientId) {
        this.identity = identity;
        this.decoder = decoder;
        this.resourceClientId = resourceClientId;
    }

    public IdentityTokens.Tokens password(String username, String password) {
        return authorized(identity.password(username, password));
    }

    public IdentityTokens.Tokens refresh(String refreshToken) {
        return authorized(identity.refresh(refreshToken));
    }

    public IdentityTokens.Tokens code(String code, String verifier, String redirectUri) {
        return authorized(identity.code(code, verifier, redirectUri));
    }

    private IdentityTokens.Tokens authorized(IdentityTokens.Tokens tokens) {
        try {
            var jwt = decoder.decode(tokens.accessToken());
            Map<String, Object> resources = jwt.getClaimAsMap("resource_access");
            boolean allowed = jwt.getSubject() != null && !jwt.getSubject().isBlank()
                    && resources != null && resources.get(resourceClientId) instanceof Map<?, ?> client
                    && client.get("roles") instanceof Collection<?> roles && roles.contains(Capabilities.CATALOG_READ);
            if (allowed)
                return tokens;
            identity.revoke(tokens.refreshToken());
            throw new ApiException(PlatformErrorCode.FORBIDDEN, "The account cannot access the admin application.");
        } catch (JwtException exception) {
            identity.revoke(tokens.refreshToken());
            throw new ApiException(AuthErrorCode.AUTH_SESSION_EXPIRED, "The identity token could not be verified.");
        }
    }
}
