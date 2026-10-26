package com.wikiaov.item.internal.application.response;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.platform.CatalogText.MetadataTranslation;
import java.util.List;

public record PublicItemCategoryView(
        String code,
        int displayOrder,
        String color,
        List<MetadataTranslation> translations,
        MediaAssetReference icon,
        MediaAssetReference background
) {
}
