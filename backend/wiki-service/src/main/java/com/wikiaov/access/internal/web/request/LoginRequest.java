package com.wikiaov.access.internal.web.request;

import com.wikiaov.platform.VerbatimText;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

public record LoginRequest(
        @NotBlank @Size(max = 254) String username,
        @NotBlank @Size(max = 1024) @VerbatimText String password,
        /** Optional six-digit authenticator code for accounts with two-step sign-in. */
        @Nullable @Pattern(regexp = "[0-9]{6}") @VerbatimText String otp
) {
    @Override
    public String toString() {
        return "LoginRequest[redacted]";
    }
}
