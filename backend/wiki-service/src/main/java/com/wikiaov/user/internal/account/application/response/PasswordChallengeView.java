package com.wikiaov.user.internal.account.application.response;

import java.time.Instant;
import java.util.UUID;

/** A code was mailed; the client confirms it with the new password before {@code expiresAt}. */
public record PasswordChallengeView(
        UUID challengeId,
        String emailHint,
        Instant expiresAt,
        Instant resendAvailableAt
) {
}
