package com.wikiaov.hero.internal.application.response;

import java.util.List;
import java.util.UUID;

public record HeroMediaGroup(
        UUID heroId,
        String code,
        String name,
        String actualLocale,
        HeroRevisionView revision,
        List<Entry> entries
) {
    public record Entry(
            String ownerType,
            String skinKey,
            String name,
            UUID assetId,
            String label,
            boolean main,
            String rarityCode
    ) {
    }
}
