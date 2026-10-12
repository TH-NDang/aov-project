package com.wikiaov.access.internal.web.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank @Size(max = 254) String username,
        @NotBlank @Size(max = 1024) String password
) {
    @Override
    public String toString() {
        return "LoginRequest[redacted]";
    }
}
