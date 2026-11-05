package com.wikiaov.platform;

import java.util.*;

/** Module boundary for change records backed by published revisions. */
public interface CatalogChangeProvider {
    String domain();

    default List<CatalogChanges.Entry> changes(UUID rulesetId, String locale) {
        return changes(rulesetId, null, locale);
    }

    List<CatalogChanges.Entry> changes(UUID rulesetId, UUID patchVariantId, String locale);
}
