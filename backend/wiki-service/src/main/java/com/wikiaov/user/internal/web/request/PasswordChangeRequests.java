package com.wikiaov.user.internal.web.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Request bodies of the password change flow (ADR-024). */
public final class PasswordChangeRequests {
    private PasswordChangeRequests() {
    }

    /** Starts a password change; {@code language} only selects the email language ({@code vi} or {@code en}). */
    public record Start(
            @Nullable @Size(max = 35) String language
    ) {
    }

    /** Confirms the mailed code and sets the new password, which is never stored or logged. */
    public record Confirm(
            @NotNull @Pattern(regexp = "[0-9]{6}") String code,
            @NotNull @Size(min = 8, max = 1024) String newPassword,
            @Nullable Boolean signOutOtherSessions,
            @Nullable @Size(max = 35) String language
    ) {
        @Override
        public String toString() {
            return "Confirm[redacted]";
        }
    }
}
