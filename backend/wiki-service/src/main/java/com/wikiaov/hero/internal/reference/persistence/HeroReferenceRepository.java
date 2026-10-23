package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.patch.GameplayContext;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** Adapts compact profile projections to the shared reference catalog contract. */
@Repository
public class HeroReferenceRepository {
    private final HeroReferenceProjectionRepository queries;

    public HeroReferenceRepository(HeroReferenceProjectionRepository queries) {
        this.queries = queries;
    }

    public List<Row> authoring(UUID rulesetId) {
        return queries.findAuthoringReferences(rulesetId).stream().map(HeroReferenceProjection::reference).toList();
    }

    public List<Row> published(GameplayContext context, Map<UUID, Long> ordinals, Instant at) {
        return queries.selectPublishedReferences(context, ordinals, at).stream()
                .map(HeroReferenceProjection::reference).toList();
    }
}
