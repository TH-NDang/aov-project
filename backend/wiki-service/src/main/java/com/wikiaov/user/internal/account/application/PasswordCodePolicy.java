package com.wikiaov.user.internal.account.application;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/** Limits for password change codes (ADR-028). The database allows at most five failed attempts. */
@ConfigurationProperties("wiki.account.password-code")
public record PasswordCodePolicy(
        @DefaultValue("10m") Duration lifetime,
        @DefaultValue("5") int maxAttempts,
        @DefaultValue("60s") Duration resendInterval,
        @DefaultValue("5") int hourlyLimit
) {
    public PasswordCodePolicy {
        if (lifetime.isNegative() || lifetime.isZero() || lifetime.compareTo(Duration.ofHours(1)) > 0)
            throw new IllegalArgumentException("Password code lifetime must be between 1 second and 1 hour");
        if (maxAttempts < 1 || maxAttempts > 5)
            throw new IllegalArgumentException("Password code attempts must be between 1 and 5");
        if (resendInterval.isNegative() || hourlyLimit < 1)
            throw new IllegalArgumentException("Invalid password code rate limit");
    }
}
