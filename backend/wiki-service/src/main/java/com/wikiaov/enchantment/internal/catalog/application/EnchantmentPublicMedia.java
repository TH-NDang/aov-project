package com.wikiaov.enchantment.internal.catalog.application;

import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class EnchantmentPublicMedia {
    private final MediaAssets media;
    private final EnchantmentContentRules contentRules;

    EnchantmentPublicMedia(MediaAssets media, EnchantmentContentRules contentRules) {
        this.media = media;
        this.contentRules = contentRules;
    }

    List<EnchantmentView> hydrate(List<EnchantmentView> rows) {
        var ids = new HashSet<UUID>();
        rows.forEach(row -> ids.addAll(contentRules.assets(row.content())));
        var found = ids.isEmpty() ? Map.<UUID, MediaAssetReference>of() : media.findAll(ids);

        return rows.stream().map(row -> {
            var visible = new LinkedHashMap<UUID, MediaAssetReference>();
            for (var id : contentRules.assets(row.content())) {
                var asset = found.get(id);
                if (asset != null && asset.usable())
                    visible.put(id, asset);
            }
            return new EnchantmentView(row.id(), row.code(), row.revision(), row.content(), row.missingFields(),
                    visible);
        }).toList();
    }

    EnchantmentView hydrate(EnchantmentView row) {
        return hydrate(List.of(row)).getFirst();
    }
}
