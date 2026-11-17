package com.wikiaov.query.internal.application;

import com.wikiaov.platform.CatalogChangeProvider;
import com.wikiaov.platform.CatalogChanges.Entry;
import com.wikiaov.platform.CatalogChanges.Kind;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class PublishedCatalogChanges {
    private PublishedCatalogChanges() {
    }

    public static List<Map<String, Object>> forVariant(CatalogChangeProvider provider, UUID ruleset, UUID variant,
            String locale,
            List<Map<String, Object>> legacyRemovals) {
        var result = new ArrayList<Map<String, Object>>();
        Map<Object, Map<String, Object>> removed = new HashMap<>();
        for (var event : legacyRemovals) {
            var row = new LinkedHashMap<>(event);
            removed.put(event.get("spellId"), row);
            result.add(row);
        }

        for (var entry : provider.changes(ruleset, variant, locale)) {
            if (!variant.equals(entry.patchVariantId()) || entry.kinds().contains(Kind.DATA_BASELINE))
                continue;
            var row = removed.get(entry.ownerId());
            if (row == null || !entry.kinds().equals(List.of(Kind.REMOVED))) {
                row = summary(entry);
                result.add(row);
            }
            if (entry.confirmed() && entry.actualLocale() != null) {
                row.put("summary", entry.summary());
                row.put("actualLocale", entry.actualLocale());
            }
            if (entry.sourceUrl() != null)
                row.putIfAbsent("sourceUrl", entry.sourceUrl());
        }
        return result;
    }

    private static Map<String, Object> summary(Entry entry) {
        Map<String, Object> subject = new LinkedHashMap<>();
        subject.put("id", entry.ownerId());
        subject.put("code", entry.code());
        subject.put("displayName", entry.name());
        subject.put("iconAssetId", entry.iconAssetId());

        Map<String, Object> row = new LinkedHashMap<>();
        row.put("domain", entry.domain());
        row.put("subject", subject);
        row.put("changeSetId", entry.id());
        row.put("changeKinds", entry.kinds());
        row.put("patchVariantId", entry.patchVariantId());
        row.put("confirmed", entry.confirmed());
        return row;
    }
}
