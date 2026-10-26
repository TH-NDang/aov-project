package com.wikiaov.item.internal.catalog.application;

import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

@Component
class ItemPublicMedia {
    private final MediaAssets media;
    private final ItemContentRules contentRules;

    ItemPublicMedia(MediaAssets media, ItemContentRules contentRules) {
        this.media = media;
        this.contentRules = contentRules;
    }

    List<ItemView> hydrate(List<ItemView> rows) {
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
            return new ItemView(row.id(), row.code(), row.revision(), row.content(), row.missingFields(), visible);
        }).toList();
    }

    ItemView hydrate(ItemView row) {
        return hydrate(List.of(row)).getFirst();
    }
}
