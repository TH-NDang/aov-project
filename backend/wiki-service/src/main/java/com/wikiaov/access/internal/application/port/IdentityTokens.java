package com.wikiaov.access.internal.application.port;

import org.jspecify.annotations.Nullable;

/** Keycloak operations used by the admin authentication gateway. */
public interface IdentityTokens {
    /** Direct grant; {@code otp} is forwarded as Keycloak's {@code totp} parameter when present. */
    Tokens password(String username, String password, @Nullable String otp);

    Tokens refresh(String refreshToken);

    Tokens code(String code, String verifier, String redirectUri);

    void revoke(String refreshToken);

    String authorizationUrl(String state, String challenge, String redirectUri);

    record Tokens(
            String accessToken,
            long expiresIn,
            String refreshToken,
            long refreshExpiresIn
    ) {
        @Override
        public String toString() {
            return "Tokens[redacted]";
        }
    }
}
