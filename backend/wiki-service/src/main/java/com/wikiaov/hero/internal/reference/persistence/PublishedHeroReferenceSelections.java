package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.patch.GameplayContext;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public interface PublishedHeroReferenceSelections {
    default List<HeroReferenceProjection> selectPublishedReferences(GameplayContext context, Map<UUID, Long> ordinals,
            Instant at) {
        return selectPublishedReferences(context, ordinals, at, true);
    }

    List<HeroReferenceProjection> selectPublishedReferences(GameplayContext context, Map<UUID, Long> ordinals,
            Instant at, boolean allowUnscoped);
}
