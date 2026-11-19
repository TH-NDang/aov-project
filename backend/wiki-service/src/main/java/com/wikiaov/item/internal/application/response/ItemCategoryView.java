package com.wikiaov.item.internal.application.response;

import com.wikiaov.platform.CatalogText.MetadataTranslation;
import java.util.List;
import java.util.UUID;

public record ItemCategoryView(
        String code,
        long version,
        int displayOrder,
        UUID iconAssetId,
        UUID backgroundAssetId,
        String color,
        List<MetadataTranslation> translations
) {
}
