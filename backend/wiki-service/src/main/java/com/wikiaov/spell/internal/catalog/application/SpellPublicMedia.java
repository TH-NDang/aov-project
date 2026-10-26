package com.wikiaov.spell.internal.catalog.application;

import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.spell.internal.application.response.SpellView;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class SpellPublicMedia {
    private final MediaAssets media;
    private final SpellContentRules contentRules;

    SpellPublicMedia(MediaAssets media, SpellContentRules contentRules) {
        this.media = media;
        this.contentRules = contentRules;
    }

    List<SpellView> hydrate(List<SpellView> rows) {
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
            return new SpellView(row.id(), row.code(), row.revision(), row.content(), row.missingFields(), visible);
        }).toList();
    }

    SpellView hydrate(SpellView row) {
        return hydrate(List.of(row)).getFirst();
    }
}
