package com.wikiaov.access.internal.application;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Client credentials are server-only. Production must use HTTPS and secure cookies. */
@ConfigurationProperties("wiki.auth")
public record AuthProperties(
        @DefaultValue("https://localhost") String adminOrigin,
        @DefaultValue("/") String adminBasePath,
        @DefaultValue("admin-aov-backend") String clientId,
        @DefaultValue("") String clientSecret,
        @DefaultValue("true") boolean secureCookies,
        @DefaultValue("false") boolean googleEnabled,
        @DefaultValue("/api/wiki/v1/auth/google/callback") String googleCallbackPath
) {
    public AuthProperties {
        java.net.URI origin = java.net.URI.create(adminOrigin);
        if (origin.getHost() == null || origin.getUserInfo() != null || origin.getQuery() != null
                || origin.getFragment() != null || (origin.getPath() != null && !origin.getPath().isEmpty())
                || !("https".equals(origin.getScheme()) || (!secureCookies && "http".equals(origin.getScheme())))) {
            throw new IllegalArgumentException("Invalid admin origin or cookie security configuration");
        }
        if (!adminBasePath.startsWith("/") || adminBasePath.startsWith("//") || !adminBasePath.endsWith("/")
                || adminBasePath.contains("..") || adminBasePath.contains("?") || adminBasePath.contains("#")) {
            throw new IllegalArgumentException("Invalid admin base path");
        }
        if (!googleCallbackPath.matches("/api/wiki/v[0-9]+/auth/google/callback")) {
            throw new IllegalArgumentException("Invalid Google callback path");
        }
    }

    public String callbackUri() {
        return adminOrigin + googleCallbackPath;
    }

    public String completionUri() {
        return adminOrigin + adminBasePath + "auth/google-complete.html";
    }

    @Override
    public String toString() {
        return "AuthProperties[redacted]";
    }
}
