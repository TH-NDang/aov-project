package com.wikiaov.enchantment.internal.application.response;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.platform.CatalogText.MetadataTranslation;
import java.util.List;

public record PublicEnchantmentBranchView(
        String code,
        int displayOrder,
        String color,
        List<MetadataTranslation> translations,
        MediaAssetReference icon,
        MediaAssetReference background
) {
}
