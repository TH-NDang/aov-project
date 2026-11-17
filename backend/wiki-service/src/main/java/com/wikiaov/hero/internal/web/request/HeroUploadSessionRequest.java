package com.wikiaov.hero.internal.web.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import tools.jackson.databind.JsonNode;

public record HeroUploadSessionRequest(
        @Min(-1) long version,
        @NotNull JsonNode state
) {
}
