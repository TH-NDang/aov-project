package com.wikiaov.access.internal.application.response;

public record AuthTokenResponse(
        String accessToken,
        long expiresIn
) {
    @Override
    public String toString() {
        return "AuthTokenResponse[redacted]";
    }
}
