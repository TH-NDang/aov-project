package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.patch.GameplayContext;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** Keeps the supplied patch order in the database selection without joining another module's entities. */
public class PublishedHeroReferenceSelectionsImpl implements PublishedHeroReferenceSelections {
    private final EntityManager entities;

    public PublishedHeroReferenceSelectionsImpl(EntityManager entities) {
        this.entities = entities;
    }

    @Override
    public List<HeroReferenceProjection> selectPublishedReferences(GameplayContext context, Map<UUID, Long> ordinals,
            Instant at) {
        var builder = entities.getCriteriaBuilder();
        var query = builder.createQuery(HeroReferenceProjection.class);
        var hero = query.from(HeroIdentity.class);
        var revision = query.from(HeroRevision.class);
        var translation = query.from(ProfileTranslationRow.class);
        var rank = ordinal(builder, revision.get("effectiveFromPatchVariantId"), ordinals);

        var newer = query.subquery(UUID.class);
        var candidate = newer.from(HeroRevision.class);
        var newerRank = ordinal(builder, candidate.get("effectiveFromPatchVariantId"), ordinals);
        newer.select(candidate.get("id")).where(
                builder.equal(candidate.get("heroId"), revision.get("heroId")),
                builder.equal(candidate.get("rulesetId"), revision.get("rulesetId")),
                builder.equal(candidate.get("state"), "PUBLISHED"),
                builder.lessThanOrEqualTo(candidate.get("publishedAt"), at),
                builder.le(newerRank, context.rulesetOrdinal()),
                builder.or(builder.gt(newerRank, rank), builder.and(builder.equal(newerRank, rank),
                        builder.gt(candidate.<Long>get("publicationSequence"), revision.get("publicationSequence")))));

        var head = query.subquery(UUID.class);
        var binding = head.from(MediaBindingRow.class);
        head.select(binding.get("assetId")).where(
                builder.equal(binding.get("mediaBindingRevisionId"), revision.get("mediaBindingRevisionId")),
                builder.equal(binding.get("mediaRole"), "HEAD"));

        query.select(builder.construct(HeroReferenceProjection.class, hero.get("id"), revision.get("id"), head,
                translation.get("locale"), translation.get("name"),
                builder.substring(builder.coalesce(translation.<String>get("summary"), ""), 1, 4000)))
                .where(builder.equal(revision.get("heroId"), hero.get("id")),
                        builder.equal(translation.get("profileRevisionId"), revision.get("profileRevisionId")),
                        builder.equal(revision.get("rulesetId"), context.rulesetId()),
                        builder.equal(revision.get("state"), "PUBLISHED"),
                        builder.lessThanOrEqualTo(revision.get("publishedAt"), at),
                        builder.le(rank, context.rulesetOrdinal()), builder.not(builder.exists(newer)))
                .orderBy(builder.asc(hero.get("code")), builder.asc(translation.get("locale")));

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
