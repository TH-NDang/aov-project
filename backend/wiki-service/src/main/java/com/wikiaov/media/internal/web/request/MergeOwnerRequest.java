package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.UUID;

/** Moves every source of an owner to {@code targetId}; {@code expectedVersion} belongs to the merged owner. */
public record MergeOwnerRequest(
        @NotNull UUID targetId,
        @NotNull @PositiveOrZero Long expectedVersion
) {
}
