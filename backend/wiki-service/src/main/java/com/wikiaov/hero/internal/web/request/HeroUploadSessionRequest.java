package com.wikiaov.hero.internal.web.request;

import jakarta.validation.constraints.*;
import tools.jackson.databind.JsonNode;

public record HeroUploadSessionRequest(
        @Min(-1) long version,
        @NotNull JsonNode state
) {
}
