package com.wikiaov.media.internal.web.request;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

public record ContactRequest(
        @Nullable UUID assetId,
        @Nullable UUID versionId,
        @NotBlank @Size(max = 200) String name,
        @NotBlank @Email @Size(max = 254) String email,
        @NotBlank @Pattern(regexp = "SOURCE|RIGHTS|OTHER") String topic,
        @NotBlank @Size(max = 4000) String message
) {
}
