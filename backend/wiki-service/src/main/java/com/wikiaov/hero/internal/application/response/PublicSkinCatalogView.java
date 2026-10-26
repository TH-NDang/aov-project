package com.wikiaov.hero.internal.application.response;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.platform.PageSlice;
import java.util.List;
import java.util.UUID;

public record PublicSkinCatalogView(
        PageSlice<Entry> page,
        List<Filter> heroes,
        List<Filter> rarities
) {
    public record Filter(
            String code,
            String name
    ) {
    }

    public record Badge(
            String code,
            String name,
            String actualLocale,
            MediaAssetReference icon
    ) {
    }

    public record Entry(
            UUID heroId,
            String heroCode,
            String heroName,
            MediaAssetReference heroHead,
            String skinKey,
            String name,
            String actualLocale,
            String rarityCode,
            Badge badge,
            MediaAssetReference portrait,
            MediaAssetReference head,
            MediaAssetReference art,
            boolean unscopedBaseline
    ) {
    }
}
