package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record DeleteMediaRequest(
        @NotNull @PositiveOrZero Long expectedVersion,
        @NotBlank @Size(max = 2000) String reason
) {
}
