package com.wikiaov.hero.internal.application.response;

import com.wikiaov.hero.internal.badges.domain.SkinBadgeGroupKind;
import java.util.List;
import java.util.UUID;

public record SkinBadgeGroupView(
        UUID id,
        String code,
        SkinBadgeGroupKind kind,
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
