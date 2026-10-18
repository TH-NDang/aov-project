package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.UUID;

public record SkinBadgeView(
        UUID id,
        String code,
        String kind,
        UUID groupId,
        long version,
        List<Translation> translations,
        String displayName,
        UUID iconAssetId,
        String actualLocale,
        boolean fallbackApplied,
        long skinCount
) {
    public record Translation(
            String locale,
            String displayName,
            UUID iconAssetId
    ) {
    }
}
