package com.wikiaov.hero.internal.catalog.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.catalog.persistence.HeroCatalogRepository.Filter;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import jakarta.persistence.criteria.*;
import java.time.Instant;
import java.util.*;
import org.springframework.data.jpa.domain.Specification;

public final class HeroCatalogSpecifications {
    private HeroCatalogSpecifications() {
    }

    public static Specification<HeroIdentity> matching(Filter filter, boolean editedFirst) {
        return (hero, query, cb) -> {
            if (query.getResultType() != Long.class) {
                List<Order> ordering = new ArrayList<>();
                if (editedFirst) {
                    var edited = query.subquery(Instant.class);
                    var revision = edited.from(HeroRevision.class);
                    edited.select(cb.greatest(revision.<Instant>get("updatedAt")))
                            .where(cb.equal(revision.get("heroId"), hero.get("id")));
                    ordering.add(cb.desc(cb.function("greatest", Instant.class, hero.get("createdAt"),
                            cb.coalesce(edited, hero.<Instant>get("createdAt")))));
                }
                ordering.add(cb.asc(hero.get("code")));
                ordering.add(cb.asc(hero.get("id")));
                query.orderBy(ordering);
            }
            return cb.and(predicates(filter, query, hero, cb));
        };
    }

    private static Predicate[] predicates(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        List<Predicate> result = new ArrayList<>();
        if (filter.rulesetId() != null)
            result.add(hasRevisionInRuleset(filter, query, hero, cb));
        if (!filter.snapshotVariants().isEmpty())
            result.add(hasSnapshotInVariants(filter, query, hero, cb));
        if (filter.changesOnly())
            result.add(hasCuratedChange(filter, query, hero, cb));
        if (!filter.q().isEmpty())
            result.add(matchesSearch(filter, query, hero, cb));

        return result.toArray(Predicate[]::new);
    }

    private static Predicate hasRevisionInRuleset(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        var revisions = query.subquery(UUID.class);
        var revision = revisions.from(HeroRevision.class);
        revisions.select(revision.get("id")).where(cb.equal(revision.get("heroId"), hero.get("id")),
                cb.equal(revision.get("rulesetId"), filter.rulesetId()),
                cb.notEqual(revision.get("state"), "DISCARDED"));

        return cb.exists(revisions);
    }

    private static Predicate hasSnapshotInVariants(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        var available = query.subquery(UUID.class);
        var revision = available.from(HeroRevision.class);
        available.select(revision.get("id")).where(cb.equal(revision.get("heroId"), hero.get("id")),
                revision.get("effectiveFromPatchVariantId").in(filter.snapshotVariants()),
                cb.equal(revision.get("state"), "PUBLISHED"));

        return cb.exists(available);
    }

    private static Predicate hasCuratedChange(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        var changes = query.subquery(UUID.class);
        var change = changes.from(HeroPatchChangeSet.class);
        var targets = changes.subquery(UUID.class);
        var target = targets.from(HeroRevision.class);
        targets.select(target.get("id")).where(cb.equal(target.get("id"), change.get("toHeroRevisionId")),
                cb.equal(target.get("state"), "PUBLISHED"), cb.equal(target.get("cause"), "GAME_PATCH"));
        changes.select(change.get("id")).where(cb.equal(change.get("heroId"), hero.get("id")),
                change.get("patchVariantId").in(filter.variants()),
                cb.or(cb.equal(change.get("sourceKind"), ChangeSource.PATCH_NOTES), cb.exists(targets)));

        return cb.exists(changes);
    }

    private static Predicate matchesSearch(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        String pattern = containsPattern(filter.q());
        String codePattern = containsPattern(filter.q().replaceAll("\\s+", "-"));
        var matching = query.subquery(UUID.class);
        var revision = matching.from(HeroRevision.class);
        var translation = matching.from(ProfileTranslationRow.class);
        var newer = newerSearchRevision(filter, matching, revision, cb);

        List<Predicate> names = searchRevisionPredicates(filter, revision, matching, cb);
        names.addAll(List.of(cb.equal(revision.get("heroId"), hero.get("id")),
                cb.equal(translation.get("profileRevisionId"), revision.get("profileRevisionId")),
                cb.like(cb.lower(translation.get("name")), pattern, '\\'), cb.not(cb.exists(newer))));
        if (filter.rulesetId() != null)
            names.add(cb.equal(revision.get("rulesetId"), filter.rulesetId()));
        matching.select(revision.get("id")).where(names.toArray(Predicate[]::new));

        return cb.or(cb.like(cb.lower(hero.get("code")), codePattern, '\\'), cb.exists(matching));
    }

    private static Subquery<UUID> newerSearchRevision(Filter filter, Subquery<UUID> matching,
            Root<HeroRevision> revision, CriteriaBuilder cb) {
        var newer = matching.subquery(UUID.class);
        var other = newer.from(HeroRevision.class);
        var otherOrdinal = ordinal(filter, other, cb);
        var currentOrdinal = ordinal(filter, revision, cb);

        List<Predicate> predicates = searchRevisionPredicates(filter, other, newer, cb);
        predicates.add(cb.equal(other.get("heroId"), revision.get("heroId")));
        predicates.add(cb.equal(other.get("rulesetId"), revision.get("rulesetId")));
        predicates.add(cb.or(cb.greaterThan(otherOrdinal, currentOrdinal),
                cb.and(cb.equal(otherOrdinal, currentOrdinal),
                        cb.greaterThan(other.<Long>get("revisionNo"), revision.get("revisionNo")))));

        return newer.select(other.get("id")).where(predicates.toArray(Predicate[]::new));
    }

    private static String containsPattern(String text) {
        return "%" + text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    private static List<Predicate> searchRevisionPredicates(Filter filter, Root<HeroRevision> revision,
            AbstractQuery<?> query, CriteriaBuilder cb) {
        List<Predicate> result = new ArrayList<>();
        if (filter.changesOnly()) {
            // A snapshot change names the hero by its target; a patch-notes change by the latest kept revision.
            var change = query.from(HeroPatchChangeSet.class);
            result.add(cb.equal(change.get("heroId"), revision.get("heroId")));
            result.add(change.get("patchVariantId").in(filter.variants()));
            result.add(cb.or(
                    cb.and(cb.equal(change.get("sourceKind"), ChangeSource.SNAPSHOT),
                            cb.equal(change.get("toHeroRevisionId"), revision.get("id")),
                            cb.equal(revision.get("state"), "PUBLISHED"),
                            cb.equal(revision.get("cause"), "GAME_PATCH")),
                    cb.and(cb.equal(change.get("sourceKind"), ChangeSource.PATCH_NOTES),
                            cb.notEqual(revision.get("state"), "DISCARDED"))));
        } else if (!filter.snapshotVariants().isEmpty()) {
            result.add(revision.get("effectiveFromPatchVariantId").in(filter.snapshotVariants()));
            result.add(cb.equal(revision.get("state"), "PUBLISHED"));
        } else {
            result.add(cb.notEqual(revision.get("state"), "DISCARDED"));
        }
        return result;
    }

    private static Expression<Long> ordinal(Filter filter, Root<HeroRevision> revision, CriteriaBuilder cb) {
        if (filter.ordinals().isEmpty())
            return cb.literal(-1L);
        var rank = cb.<UUID, Long>selectCase(revision.get("effectiveFromPatchVariantId"));
        filter.ordinals().forEach(rank::when);
        return rank.otherwise(-1L);
    }

}
