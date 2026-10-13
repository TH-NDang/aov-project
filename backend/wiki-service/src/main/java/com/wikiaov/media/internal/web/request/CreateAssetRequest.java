package com.wikiaov.media.internal.web.request;

import com.wikiaov.media.MediaSemanticType;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.jspecify.annotations.Nullable;

/** Body of {@code POST /admin/media/assets}. */
public record CreateAssetRequest(
        @NotNull MediaSemanticType semanticType,
        @Valid @Nullable SourceRequest source
) {
}
