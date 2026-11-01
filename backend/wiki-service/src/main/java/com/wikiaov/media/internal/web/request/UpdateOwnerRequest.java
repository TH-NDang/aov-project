package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Renames an owner or changes its contact; {@code contactUrl} null removes it. */
public record UpdateOwnerRequest(
        @NotBlank @Size(max = 200) String name,
        @Nullable @Size(max = 2048) @Pattern(regexp = "https?://\\S+", message = "must be an http(s) URL") String contactUrl,
        @NotNull @PositiveOrZero Long expectedVersion
) {
}
