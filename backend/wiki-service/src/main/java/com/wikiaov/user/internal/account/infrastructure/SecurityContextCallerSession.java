package com.wikiaov.user.internal.account.infrastructure;

import com.wikiaov.user.internal.account.application.port.CallerSession;
import java.util.Optional;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/** Reads the verified bearer token of the current request. */
@Component
class SecurityContextCallerSession implements CallerSession {

    @Override
    public Optional<String> sessionId() {
        return Optional.ofNullable(jwt().getClaimAsString("sid")).filter(value -> !value.isBlank());
    }

    @Override
    public String accessToken() {
        return jwt().getTokenValue();
    }

    private static Jwt jwt() {
        if (SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken token)
            return token.getToken();
        throw new AuthenticationCredentialsNotFoundException("A bearer token is required.");
    }
}
