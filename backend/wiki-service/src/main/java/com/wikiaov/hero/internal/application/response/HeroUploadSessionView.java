package com.wikiaov.hero.internal.application.response;

import java.time.Instant;
import java.util.UUID;
import tools.jackson.databind.JsonNode;

public record HeroUploadSessionView(
        UUID id,
        long version,
        Instant updatedAt,
        JsonNode state
) {
}
