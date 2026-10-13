package com.wikiaov.media.internal.web.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Body of {@code POST /admin/media/imports/register}. */
public record RegisterImportRequest(
        @NotNull UUID assetId,
        @NotBlank @Size(max = 1024) String objectKey,
        @Valid @Nullable SourceRequest source
) {
}
