package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.UUID;

public record SkinBadgeGroupView(
        UUID id,
        String code,
        String kind,
        long version,
        List<Translation> translations,
        String displayName,
        String actualLocale,
        boolean fallbackApplied,
        long badgeCount,
        boolean matchedByGroup
) {
    public record Translation(
            String locale,
            String displayName
    ) {
    }
}
