package com.wikiaov.patch.internal.application.response;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record SeasonUpdatesView(
        String region,
        String requestedLocale,
        Instant asOf,
        Season season,
        UUID currentPatchId,
        List<Patch> patches
) {
    public record Season(
            UUID id,
            String code,
            String displayName
    ) {
    }

    public record Patch(
            UUID id,
            String code,
            String title,
            String summary,
            String actualLocale,
            Instant effectiveAt,
            LocalDate effectiveOn,
            String sourceUrl,
            boolean isCurrent
    ) {
    }
}
