package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record SourceReferencesRequest(
        @NotNull @Min(0) Long expectedVersion,
        @Nullable UUID ownerPageId,
        @Nullable UUID relatedPageId
) {
}
