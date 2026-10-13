package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

/** Body of commands guarded by optimistic locking, e.g. activate a version. */
public record ExpectedVersionRequest(
        @NotNull @PositiveOrZero Long expectedVersion
) {
}
