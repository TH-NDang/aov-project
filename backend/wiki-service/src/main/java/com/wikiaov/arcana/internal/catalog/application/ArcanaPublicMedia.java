package com.wikiaov.arcana.internal.catalog.application;

import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ArcanaPublicMedia {
    private final MediaAssets media;
    private final ArcanaContentRules contentRules;

    ArcanaPublicMedia(MediaAssets media, ArcanaContentRules contentRules) {
        this.media = media;
        this.contentRules = contentRules;
    }

    List<ArcanaView> hydrate(List<ArcanaView> rows) {
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
            return new ArcanaView(row.id(), row.code(), row.revision(), row.content(), row.missingFields(), visible);
        }).toList();
    }

    ArcanaView hydrate(ArcanaView row) {
        return hydrate(List.of(row)).getFirst();
    }
}
