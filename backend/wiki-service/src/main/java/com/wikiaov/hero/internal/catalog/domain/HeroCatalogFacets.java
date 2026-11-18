package com.wikiaov.hero.internal.catalog.domain;

import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import java.util.Set;

public record HeroCatalogFacets(
        Set<Role> roles,
        Set<Position> positions,
        Boolean hasWarnings
) {
    public boolean active() {
        return !roles.isEmpty() || !positions.isEmpty() || hasWarnings != null;
    }
}
