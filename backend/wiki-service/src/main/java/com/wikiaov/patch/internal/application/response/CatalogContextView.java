package com.wikiaov.patch.internal.application.response;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public record CatalogContextView(
        List<RegionView> regions,
        List<Language> locales,
        List<Season> seasons,
        Current current
) {
    public record Language(
            String code,
            String name,
            String nativeName
    ) {
    }

    public record Season(
            UUID id,
            String code,
            String name,
            long ordinal,
            boolean current,
            List<Patch> patches
    ) {
    }

    public record Patch(
            UUID id,
            String code,
            String title,
            UUID rulesetId,
            long ordinal,
            boolean published,
            LocalDate regionalDate,
            boolean unknownDate
    ) {
    }

    public record Current(
            UUID rulesetId,
            UUID seasonId,
            UUID patchVariantId
    ) {
    }
}
