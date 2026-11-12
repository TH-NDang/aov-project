package com.wikiaov.user.internal.account.application.response;

import java.time.Instant;
import org.jspecify.annotations.Nullable;

/** Security state of the caller's account as held by the identity provider. */
public record SecurityOverview(
        @Nullable String email,
        boolean emailVerified,
        Password password,
        boolean passwordChangeAvailable,
        TwoFactor twoFactor
) {
    public record Password(
            boolean set,
            @Nullable Instant updatedAt
    ) {
    }

    public record TwoFactor(
            boolean enabled,
            @Nullable String credentialId,
            @Nullable String label,
            @Nullable Instant createdAt,
            @Nullable RecoveryCodes recoveryCodes
    ) {
    }

    public record RecoveryCodes(
            String credentialId,
            @Nullable Integer remaining,
            @Nullable Integer total,
            @Nullable Instant createdAt
    ) {
    }
}
