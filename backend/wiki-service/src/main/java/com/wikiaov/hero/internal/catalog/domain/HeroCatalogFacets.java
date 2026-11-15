package com.wikiaov.hero.internal.catalog.domain;

import java.util.Set;

public record HeroCatalogFacets(
        Set<String> roles,
        Set<String> positions,
        Boolean hasWarnings
) {
    public boolean active() {
        return !roles.isEmpty() || !positions.isEmpty() || hasWarnings != null;
    }
}
