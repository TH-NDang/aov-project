package com.wikiaov.hero.internal.media.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.skins.persistence.entity.SkinTranslationRow;

import jakarta.persistence.criteria.*;
import java.util.*;
import org.springframework.data.jpa.domain.Specification;

public final class HeroMediaSpecifications {
    private HeroMediaSpecifications() {
    }

    public static Specification<HeroRevision> selected(UUID ruleset, Map<UUID, Long> ordinals, String q, boolean page) {
        return (revision, query, cb) -> {
            var hero = query.from(HeroIdentity.class);
            if (query.getResultType() != Long.class) {
                List<Order> ordering = new ArrayList<>(
                        List.of(cb.asc(hero.get("code")), cb.asc(revision.get("rulesetId"))));
                if (page)
                    ordering.add(cb.asc(revision.get("id")));
                query.orderBy(ordering);
            }
            return cb.and(selected(query, revision, hero, cb, ruleset, ordinals, q));
        };
    }

    private static Predicate[] selected(CriteriaQuery<?> query, Root<HeroRevision> revision, Root<HeroIdentity> hero,
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

}
