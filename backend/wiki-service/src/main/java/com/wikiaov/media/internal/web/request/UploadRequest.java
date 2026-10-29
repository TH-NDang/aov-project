package com.wikiaov.media.internal.web.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.jspecify.annotations.Nullable;

/** Body of {@code POST /admin/media/assets/{assetId}/version-uploads}: what the client says it will upload. */
public record UploadRequest(
        @Nullable @Size(max = 255) String fileName,
        @NotBlank @Size(max = 100) String contentType,
        @NotNull @Positive Long sizeBytes,
        @Nullable @Valid SourceRequest source
) {
}
