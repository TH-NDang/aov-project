package com.wikiaov.hero.internal.persistence;

import com.wikiaov.hero.internal.persistence.entity.*;
import com.wikiaov.platform.PageSlice;
import jakarta.persistence.*;
import jakarta.persistence.criteria.*;
import java.util.*;
import org.springframework.stereotype.Repository;

@Repository
public class HeroMediaRepository {
    private final EntityManager entities;

    public HeroMediaRepository(EntityManager entities) {
        this.entities = entities;
    }

    public PageSlice<HeroRevision> page(UUID ruleset, Map<UUID, Long> ordinals, String q, int page, int size) {
        var cb = entities.getCriteriaBuilder();
        var query = cb.createQuery(HeroRevision.class);
        var revision = query.from(HeroRevision.class);
        var hero = query.from(HeroIdentity.class);
        query.select(revision).where(selected(query, revision, hero, cb, ruleset, ordinals, q))
                .orderBy(cb.asc(hero.get("code")), cb.asc(revision.get("rulesetId")), cb.asc(revision.get("id")));
        var items = entities.createQuery(query).setFirstResult(page * size).setMaxResults(size).getResultList();
        var count = cb.createQuery(Long.class);
        var counted = count.from(HeroRevision.class);
        var countedHero = count.from(HeroIdentity.class);
        count.select(cb.count(counted)).where(selected(count, counted, countedHero, cb, ruleset, ordinals, q));
        return new PageSlice<>(items, page, size, entities.createQuery(count).getSingleResult());
    }

    public List<HeroRevision> selected(UUID ruleset, Map<UUID, Long> ordinals) {
        var cb = entities.getCriteriaBuilder();
        var query = cb.createQuery(HeroRevision.class);
        var revision = query.from(HeroRevision.class);
        var hero = query.from(HeroIdentity.class);
        query.select(revision).where(selected(query, revision, hero, cb, ruleset, ordinals, ""))
                .orderBy(cb.asc(hero.get("code")), cb.asc(revision.get("rulesetId")));
        return entities.createQuery(query).getResultList();
    }

    private Predicate[] selected(CriteriaQuery<?> query, Root<HeroRevision> revision, Root<HeroIdentity> hero,
            CriteriaBuilder cb, UUID ruleset, Map<UUID, Long> ordinals, String q) {
        List<Predicate> predicates = new ArrayList<>();
        predicates.add(cb.equal(hero.get("id"), revision.get("heroId")));
        predicates.add(cb.notEqual(revision.get("state"), "DISCARDED"));
        if (ruleset != null)
            predicates.add(cb.equal(revision.get("rulesetId"), ruleset));
        var newer = query.subquery(UUID.class);
        var other = newer.from(HeroRevision.class);
        var rank = ordinal(revision, ordinals, cb);
        var otherRank = ordinal(other, ordinals, cb);
        newer.select(other.get("id")).where(cb.equal(other.get("heroId"), revision.get("heroId")),
                cb.equal(other.get("rulesetId"), revision.get("rulesetId")),
                cb.notEqual(other.get("state"), "DISCARDED"),
                cb.or(cb.greaterThan(otherRank, rank), cb.and(cb.equal(otherRank, rank),
                        cb.greaterThan(other.<Long>get("revisionNo"), revision.get("revisionNo")))));
        predicates.add(cb.not(cb.exists(newer)));
        if (!q.isEmpty()) {
            String pattern = pattern(q);
            var names = query.subquery(UUID.class);
            var text = names.from(ProfileTranslationRow.class);
            names.select(text.get("profileRevisionId")).where(
                    cb.equal(text.get("profileRevisionId"), revision.get("profileRevisionId")),
                    cb.like(cb.lower(text.get("name")), pattern, '\\'));
            var skinNames = query.subquery(UUID.class);
            var skin = skinNames.from(SkinTranslationRow.class);
            skinNames.select(skin.get("skinSetRevisionId")).where(
                    cb.equal(skin.get("skinSetRevisionId"), revision.get("skinsRevisionId")),
                    cb.or(cb.like(cb.lower(skin.get("name")), pattern, '\\'),
                            cb.like(cb.lower(skin.get("skinKey")), pattern(q.replaceAll("\\s+", "-")), '\\')));
            predicates.add(cb.or(cb.like(cb.lower(hero.get("code")), pattern(q.replaceAll("\\s+", "-")), '\\'),
                    cb.exists(names), cb.exists(skinNames)));
        }
        return predicates.toArray(Predicate[]::new);
    }

    private static Expression<Long> ordinal(Root<HeroRevision> revision, Map<UUID, Long> ordinals, CriteriaBuilder cb) {
        if (ordinals.isEmpty())
            return cb.literal(-1L);
        var result = cb.<UUID, Long>selectCase(revision.get("effectiveFromPatchVariantId"));
        ordinals.forEach(result::when);
        return result.otherwise(-1L);
    }

    private static String pattern(String q) {
        return "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
    }

    public <T> List<T> rows(Class<T> type, String property, Collection<UUID> ids) {
        if (ids.isEmpty())
            return List.of();
        return entities
                .createQuery("select e from " + type.getSimpleName() + " e where e." + property + " in :ids", type)
                .setParameter("ids", ids).getResultList();
    }

    public void replaceBadgeTranslations(UUID id, List<SkinBadgeTranslation> translations) {
        Map<String, SkinBadgeTranslation> incoming = new HashMap<>();
        translations.forEach(text -> incoming.put(text.getLocale(), text));
        for (var old : rows(SkinBadgeTranslation.class, "badgeId", List.of(id))) {
            var next = incoming.remove(old.getLocale());
            if (next == null)
                entities.remove(old);
            else {
                old.setDisplayName(next.getDisplayName());
                old.setIconAssetId(next.getIconAssetId());
            }
        }
        incoming.values().forEach(entities::persist);
        entities.flush();
    }

    public void replaceBadgeGroupTranslations(UUID id, List<SkinBadgeGroupTranslation> translations) {
        Map<String, SkinBadgeGroupTranslation> incoming = new HashMap<>();
        translations.forEach(text -> incoming.put(text.getLocale(), text));
        for (var old : rows(SkinBadgeGroupTranslation.class, "groupId", List.of(id))) {
            var next = incoming.remove(old.getLocale());
            if (next == null)
                entities.remove(old);
            else
                old.setDisplayName(next.getDisplayName());
        }
        incoming.values().forEach(entities::persist);
        entities.flush();
    }
}
