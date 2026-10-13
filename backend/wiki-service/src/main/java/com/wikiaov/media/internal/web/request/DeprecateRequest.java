package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Body of {@code POST /admin/media/assets/{assetId}/deprecate}. */
public record DeprecateRequest(
        @NotNull @PositiveOrZero Long expectedVersion,
        @Nullable @Size(max = 2000) String reason
) {
}
