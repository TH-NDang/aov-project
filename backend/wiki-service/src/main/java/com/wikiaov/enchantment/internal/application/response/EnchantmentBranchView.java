package com.wikiaov.enchantment.internal.application.response;

import com.wikiaov.platform.CatalogText.MetadataTranslation;
import java.util.*;

public record EnchantmentBranchView(
        String code,
        long version,
        int displayOrder,
        UUID iconAssetId,
        UUID backgroundAssetId,
        String color,
        List<MetadataTranslation> translations
) {
}
