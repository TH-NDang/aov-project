package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.*;
import com.wikiaov.platform.PageSlice;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.*;
import java.time.Instant;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class HeroCatalogRepository {
    private final EntityManager entities;

    public HeroCatalogRepository(EntityManager entities) {
        this.entities = entities;
    }

    public record Filter(
            String q,
            UUID rulesetId,
            Set<UUID> variants,
            Map<UUID, Long> ordinals,
            boolean changesOnly
    ) {
    }

    public PageSlice<HeroIdentity> page(Filter filter, int page, int size, boolean editedFirst) {
        var cb = entities.getCriteriaBuilder();
        var query = cb.createQuery(HeroIdentity.class);
        var hero = query.from(HeroIdentity.class);
        query.select(hero).where(predicates(filter, query, hero, cb));
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
        var items = entities.createQuery(query).setFirstResult(page * size).setMaxResults(size).getResultList();
        var count = cb.createQuery(Long.class);
        var counted = count.from(HeroIdentity.class);
        count.select(cb.count(counted)).where(predicates(filter, count, counted, cb));
        return new PageSlice<>(items, page, size, entities.createQuery(count).getSingleResult());
    }

    private Predicate[] predicates(Filter filter, CriteriaQuery<?> query, Root<HeroIdentity> hero,
            CriteriaBuilder cb) {
        List<Predicate> result = new ArrayList<>();
        if (filter.rulesetId() != null) {
            var revisions = query.subquery(UUID.class);
            var revision = revisions.from(HeroRevision.class);
            revisions.select(revision.get("id")).where(cb.equal(revision.get("heroId"), hero.get("id")),
                    cb.equal(revision.get("rulesetId"), filter.rulesetId()),
                    cb.notEqual(revision.get("state"), "DISCARDED"));
            result.add(cb.exists(revisions));
        }
        if (filter.changesOnly()) {
            var changes = query.subquery(UUID.class);
            var change = changes.from(HeroPatchChangeSet.class);
            var target = changes.from(HeroRevision.class);
            changes.select(change.get("id")).where(cb.equal(change.get("heroId"), hero.get("id")),
                    change.get("patchVariantId").in(filter.variants()),
                    cb.equal(target.get("id"), change.get("toHeroRevisionId")),
                    cb.equal(target.get("state"), "PUBLISHED"), cb.equal(target.get("cause"), "GAME_PATCH"));
            result.add(cb.exists(changes));
        }
        if (!filter.q().isEmpty()) {
            String pattern = "%" + filter.q().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            String codePattern = "%" + filter.q().replaceAll("\\s+", "-").replace("\\", "\\\\")
                    .replace("%", "\\%").replace("_", "\\_") + "%";
            var matching = query.subquery(UUID.class);
            var revision = matching.from(HeroRevision.class);
            var translation = matching.from(ProfileTranslationRow.class);
            var newer = matching.subquery(UUID.class);
            var other = newer.from(HeroRevision.class);
            var otherOrdinal = ordinal(filter, other, cb);
            var currentOrdinal = ordinal(filter, revision, cb);
            List<Predicate> newerPredicates = searchRevisionPredicates(filter, other, newer, cb);
            newerPredicates.add(cb.equal(other.get("heroId"), revision.get("heroId")));
            newerPredicates.add(cb.equal(other.get("rulesetId"), revision.get("rulesetId")));
            newerPredicates.add(cb.or(cb.greaterThan(otherOrdinal, currentOrdinal),
                    cb.and(cb.equal(otherOrdinal, currentOrdinal),
                            cb.greaterThan(other.<Long>get("revisionNo"), revision.get("revisionNo")))));
            newer.select(other.get("id")).where(newerPredicates.toArray(Predicate[]::new));
            List<Predicate> names = searchRevisionPredicates(filter, revision, matching, cb);
            names.addAll(List.of(cb.equal(revision.get("heroId"), hero.get("id")),
                    cb.equal(translation.get("profileRevisionId"), revision.get("profileRevisionId")),
                    cb.like(cb.lower(translation.get("name")), pattern, '\\'), cb.not(cb.exists(newer))));
            if (filter.rulesetId() != null)
                names.add(cb.equal(revision.get("rulesetId"), filter.rulesetId()));
            matching.select(revision.get("id")).where(names.toArray(Predicate[]::new));
            result.add(cb.or(cb.like(cb.lower(hero.get("code")), codePattern, '\\'), cb.exists(matching)));
        }
        return result.toArray(Predicate[]::new);
    }

    private static List<Predicate> searchRevisionPredicates(Filter filter, Root<HeroRevision> revision,
            AbstractQuery<?> query, CriteriaBuilder cb) {
        List<Predicate> result = new ArrayList<>();
        if (filter.changesOnly()) {
            var change = query.from(HeroPatchChangeSet.class);
            result.add(cb.equal(change.get("toHeroRevisionId"), revision.get("id")));
            result.add(change.get("patchVariantId").in(filter.variants()));
            result.add(cb.equal(revision.get("state"), "PUBLISHED"));
            result.add(cb.equal(revision.get("cause"), "GAME_PATCH"));
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

    public Map<UUID, Instant> editedTimes(Collection<UUID> heroIds) {
        Map<UUID, Instant> result = new HashMap<>();
        entities.createQuery(
                "select r.heroId,max(r.updatedAt) from HeroRevision r where r.heroId in :ids group by r.heroId",
                Object[].class).setParameter("ids", heroIds).getResultList()
                .forEach(row -> result.put((UUID) row[0], (Instant) row[1]));
        return result;
    }

    public List<HeroPatchChangeSet> changes(Collection<UUID> heroIds, Collection<UUID> variants) {
        return entities.createQuery(
                "select c from HeroPatchChangeSet c where c.heroId in :heroes and c.patchVariantId in :variants",
                HeroPatchChangeSet.class).setParameter("heroes", heroIds).setParameter("variants", variants)
                .getResultList();
    }

    public List<Object[]> classifications(Collection<UUID> changeSets) {
        return entities.createQuery(
                "select distinct c.changeSetId,c.changeKind from HeroChangeClassification c where c.changeSetId in :ids",
                Object[].class).setParameter("ids", changeSets).getResultList();
    }

    public List<HeroPatchChangeTranslation> translations(Collection<UUID> changeSets) {
        return entities.createQuery("select t from HeroPatchChangeTranslation t where t.changeSetId in :ids",
                HeroPatchChangeTranslation.class).setParameter("ids", changeSets).getResultList();
    }
}
