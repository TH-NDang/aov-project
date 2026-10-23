package com.wikiaov.platform;

import java.time.Instant;
import java.util.*;

/** Shared vocabulary; each catalog owns its change records and persistence. */
public final class CatalogChanges {
    private CatalogChanges() {
    }

    public enum Kind {
        DATA_BASELINE,
        ADDED,
        UPDATED,
        REMOVED,
        BUFF,
        NERF,
        BALANCE,
        REWORK,
        FIX
    }

    public record Summary(
            String locale,
            String text
    ) {
    }

    public record Record(
            UUID patchVariantId,
            UUID toRevisionId,
            UUID fromRevisionId,
            List<Kind> kinds,
            List<Summary> translations,
            String sourceUrl
    ) {
    }

    public record Entry(
            UUID id,
            String domain,
            UUID ownerId,
            String code,
            String name,
            UUID iconAssetId,
            UUID rulesetId,
            UUID patchVariantId,
            UUID fromRevisionId,
            UUID toRevisionId,
            List<Kind> kinds,
            String summary,
            String actualLocale,
            String sourceUrl,
            boolean confirmed,
            Instant recordedAt
    ) {
    }

    public static Summary summary(List<Summary> copy, String locale) {
        for (String candidate : List.of(locale, "vi-VN", "en-US"))
            for (var text : copy)
                if (candidate.equals(text.locale()))
                    return text;
        return copy.stream().sorted(Comparator.comparing(Summary::locale)).findFirst().orElse(null);
    }
}
