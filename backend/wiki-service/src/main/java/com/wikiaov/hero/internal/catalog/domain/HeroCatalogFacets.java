package com.wikiaov.hero.internal.catalog.domain;

import java.util.Set;

public record HeroCatalogFacets(
        Set<String> roles,
        Set<String> positions,
        Boolean hasWarnings
) {
    public static final HeroCatalogFacets ALL = new HeroCatalogFacets(Set.of(), Set.of(), null);

    public boolean active() {
        return !roles.isEmpty() || !positions.isEmpty() || hasWarnings != null;
    }
}
