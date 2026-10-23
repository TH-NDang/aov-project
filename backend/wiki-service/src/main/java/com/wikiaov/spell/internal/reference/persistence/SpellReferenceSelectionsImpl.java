package com.wikiaov.spell.internal.reference.persistence;

import com.wikiaov.spell.internal.catalog.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellTranslation;
import com.wikiaov.terminology.AdminReferenceProvider.Row;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** Builds only the CASE ranking that depends on patch ordinals supplied by the patch module. */
public class SpellReferenceSelectionsImpl implements SpellReferenceSelections {
    private final EntityManager entities;

    public SpellReferenceSelectionsImpl(EntityManager entities) {
        this.entities = entities;
    }

    @Override
    public List<Row> selectReferenceRows(UUID rulesetId, Map<UUID, Long> ordinals, boolean published, long cutoff) {
        var builder = entities.getCriteriaBuilder();
        var query = builder.createQuery(Row.class);
        var identity = query.from(SpellIdentity.class);
        var revision = query.from(SpellRevision.class);
        var translation = query.from(SpellTranslation.class);
        var rank = ordinal(builder, revision.get("effectiveFromPatchVariantId"), ordinals);
        var predicates = new ArrayList<Predicate>();
        predicates.add(builder.equal(revision.get("ownerId"), identity.get("id")));
        predicates.add(builder.equal(translation.get("revisionId"), revision.get("id")));
        predicates.add(builder.equal(revision.get("rulesetId"), rulesetId));
        predicates.add(published
                ? builder.equal(revision.get("state"), "PUBLISHED")
                : builder.notEqual(revision.get("state"), "DISCARDED"));
        predicates.add(builder.equal(translation.get("targetKey"), ""));
        if (published) {
            predicates.add(builder.le(rank, cutoff));
            predicates.add(builder.isNotNull(revision.get("effectiveFromPatchVariantId")));
        }

        var newer = query.subquery(UUID.class);
        var candidate = newer.from(SpellRevision.class);
        var newerRank = ordinal(builder, candidate.get("effectiveFromPatchVariantId"), ordinals);
        Expression<Long> sequence = published
                ? builder.coalesce(revision.<Long>get("publicationSequence"), 0L)
                : revision.get("revisionNo");
        Expression<Long> newerSequence = published
                ? builder.coalesce(candidate.<Long>get("publicationSequence"), 0L)
                : candidate.get("revisionNo");
        var newerPredicates = new ArrayList<Predicate>();
        newerPredicates.add(builder.equal(candidate.get("ownerId"), revision.get("ownerId")));
        newerPredicates.add(builder.equal(candidate.get("rulesetId"), revision.get("rulesetId")));
        newerPredicates.add(published
                ? builder.equal(candidate.get("state"), "PUBLISHED")
                : builder.notEqual(candidate.get("state"), "DISCARDED"));
        if (published) {
            newerPredicates.add(builder.le(newerRank, cutoff));
            newerPredicates.add(builder.isNotNull(candidate.get("effectiveFromPatchVariantId")));
        }
        newerPredicates.add(builder.or(builder.gt(newerRank, rank),
                builder.and(builder.equal(newerRank, rank), builder.gt(newerSequence, sequence))));
        newer.select(candidate.get("id")).where(newerPredicates.toArray(Predicate[]::new));
        predicates.add(builder.not(builder.exists(newer)));

        var description = builder.<String>coalesce()
                .value(builder.nullif(translation.<String>get("description"), ""))
                .value(translation.<String>get("summary")).value("");
        query.select(builder.construct(Row.class, identity.get("id"), revision.get("id"), revision.get("iconAssetId"),
                translation.get("locale"), translation.get("name"), builder.substring(description, 1, 4000)))
                .where(predicates.toArray(Predicate[]::new))
                .orderBy(builder.asc(identity.get("code")), builder.asc(translation.get("locale")));

        return entities.createQuery(query).getResultList();
    }

    private static Expression<Long> ordinal(CriteriaBuilder builder, Path<UUID> patch, Map<UUID, Long> ordinals) {
        if (ordinals.isEmpty())
            return builder.literal(0L);

        var rank = builder.<UUID, Long>selectCase(patch);
        new TreeMap<>(ordinals).forEach(rank::when);
        return rank.otherwise(0L);
    }
}
