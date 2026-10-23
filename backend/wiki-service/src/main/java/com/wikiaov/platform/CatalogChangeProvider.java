package com.wikiaov.platform;

import java.util.*;

/** Module boundary for the administrative cross-catalog change read model. */
public interface CatalogChangeProvider {
    String domain();

    List<CatalogChanges.Entry> changes(UUID rulesetId, String locale);
}
