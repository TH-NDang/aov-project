package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.badges.domain.SkinBadgeKind;
import java.util.List;
import java.util.UUID;

public record SkinBadgeView(
        UUID id,
        String code,
        SkinBadgeKind kind,
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
