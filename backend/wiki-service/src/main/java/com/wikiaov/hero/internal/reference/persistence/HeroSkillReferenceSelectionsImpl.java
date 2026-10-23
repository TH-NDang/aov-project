package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.domain.SkillReferenceSearch;
import com.wikiaov.hero.internal.media.persistence.entity.MediaBindingRow;
import com.wikiaov.hero.internal.profile.persistence.entity.ProfileTranslationRow;
import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Copy;
import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Result;
import com.wikiaov.hero.internal.reference.persistence.HeroSkillReferenceRepository.Row;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillSnapshotRow;
import com.wikiaov.hero.internal.skills.persistence.entity.SkillTranslationRow;
import jakarta.persistence.EntityManager;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;

/** Pages scalar identities before reading bounded localized copy; no gameplay sections are hydrated. */
public class HeroSkillReferenceSelectionsImpl implements HeroSkillReferenceSelections {
    private final EntityManager entities;

    public HeroSkillReferenceSelectionsImpl(EntityManager entities) {
        this.entities = entities;
    }

    @Override
    public Result selectSkills(SkillReferenceCriteria criteria) {
        var builder = entities.getCriteriaBuilder();
        var count = builder.createQuery(Long.class);
        var counted = selection(builder, count, criteria);
        count.select(builder.count(counted.skill().get("skillKey"))).where(counted.predicates());
        long total = entities.createQuery(count).getSingleResult();
        if (criteria.offset() >= total)
            return new Result(List.of(), total);

        var query = builder.createQuery(Row.class);
        var selected = selection(builder, query, criteria);
        var hero = selected.hero();
        var revision = selected.revision();
        var skill = selected.skill();

        var head = query.subquery(UUID.class);
        var binding = head.from(MediaBindingRow.class);
        head.select(binding.get("assetId")).where(
                builder.equal(binding.get("mediaBindingRevisionId"), revision.get("mediaBindingRevisionId")),
                builder.equal(binding.get("mediaRole"), "HEAD"));

        query.select(builder.construct(Row.class, hero.get("id"), hero.get("code"), revision.get("id"),
                revision.get("profileRevisionId"), revision.get("skillsRevisionId"), head, skill.get("skillKey"),
                skill.get("formKey"), skill.get("iconAssetId")))
                .where(selected.predicates())
                .orderBy(builder.asc(hero.get("code")), builder.asc(hero.get("id")),
                        builder.asc(skill.get("displayOrder")), builder.asc(skill.get("skillKey")));

        var rows = entities.createQuery(query).setFirstResult(Math.toIntExact(criteria.offset()))
                .setMaxResults(criteria.size()).getResultList();

        return new Result(rows, total);
    }

    private static Selection selection(CriteriaBuilder builder, CriteriaQuery<?> query,
            SkillReferenceCriteria criteria) {
        var hero = query.from(HeroIdentity.class);
        var revision = query.from(HeroRevision.class);
        var skill = query.from(SkillSnapshotRow.class);
        var predicates = new ArrayList<Predicate>();
        predicates.add(builder.equal(revision.get("heroId"), hero.get("id")));
        predicates.add(builder.equal(skill.get("skillSetRevisionId"), revision.get("skillsRevisionId")));
        predicates.add(builder.equal(revision.get("rulesetId"), criteria.rulesetId()));
        predicates.add(criteria.published()
                ? builder.equal(revision.get("state"), "PUBLISHED")
                : builder.notEqual(revision.get("state"), "DISCARDED"));

        var newer = query.subquery(UUID.class);
        var candidate = newer.from(HeroRevision.class);
        var newerPredicates = new ArrayList<Predicate>();
        newerPredicates.add(builder.equal(candidate.get("heroId"), revision.get("heroId")));
        newerPredicates.add(builder.equal(candidate.get("rulesetId"), revision.get("rulesetId")));
        newerPredicates.add(criteria.published()
                ? builder.equal(candidate.get("state"), "PUBLISHED")
                : builder.notEqual(candidate.get("state"), "DISCARDED"));
        if (criteria.published()) {
            var rank = ordinal(builder, revision.get("effectiveFromPatchVariantId"), criteria.ordinals());
            var newerRank = ordinal(builder, candidate.get("effectiveFromPatchVariantId"), criteria.ordinals());
            predicates.add(builder.lessThanOrEqualTo(revision.get("publishedAt"), criteria.at()));
            predicates.add(builder.le(rank, criteria.cutoff()));
            newerPredicates.add(builder.lessThanOrEqualTo(candidate.get("publishedAt"), criteria.at()));
            newerPredicates.add(builder.le(newerRank, criteria.cutoff()));
            newerPredicates.add(builder.or(builder.gt(newerRank, rank), builder.and(builder.equal(newerRank, rank),
                    builder.gt(candidate.<Long>get("publicationSequence"), revision.get("publicationSequence")))));
        } else {
            newerPredicates.add(builder.gt(candidate.<Long>get("revisionNo"), revision.get("revisionNo")));
        }

        if (!criteria.ids().isEmpty()) {
            var matches = new ArrayList<Predicate>();
            for (var id : criteria.ids()) {
                int separator = id.indexOf('.');
                matches.add(builder.and(builder.equal(hero.get("id"), UUID.fromString(id.substring(0, separator))),
                        builder.equal(skill.get("skillKey"), id.substring(separator + 1))));
            }
            predicates.add(builder.or(matches.toArray(Predicate[]::new)));
            var containing = newer.subquery(String.class);
            var contained = containing.from(SkillSnapshotRow.class);
            containing.select(contained.get("skillKey")).where(
                    builder.equal(contained.get("skillSetRevisionId"), candidate.get("skillsRevisionId")),
                    builder.equal(contained.get("skillKey"), skill.get("skillKey")));
            newerPredicates.add(builder.exists(containing));
        }

        newer.select(candidate.get("id")).where(newerPredicates.toArray(Predicate[]::new));
        predicates.add(builder.not(builder.exists(newer)));
        if (criteria.heroId() != null)
            predicates.add(builder.equal(hero.get("id"), criteria.heroId()));
        if (criteria.search().sourceSlot() != null)
            predicates.add(sourceSlot(builder, skill, criteria.search()));

        for (String word : criteria.search().words()) {
            String pattern = "%" + word.replace("!", "!!").replace("%", "!%").replace("_", "!_") + "%";
            var ownerCopy = query.subquery(String.class);
            var profile = ownerCopy.from(ProfileTranslationRow.class);
            ownerCopy.select(profile.get("locale")).where(
                    builder.equal(profile.get("profileRevisionId"), revision.get("profileRevisionId")),
                    builder.like(normalized(builder, profile.get("name")), pattern, '!'));
            var skillCopy = query.subquery(String.class);
            var translation = skillCopy.from(SkillTranslationRow.class);
            skillCopy.select(translation.get("locale")).where(
                    builder.equal(translation.get("skillSetRevisionId"), revision.get("skillsRevisionId")),
                    builder.equal(translation.get("skillKey"), skill.get("skillKey")),
                    builder.like(normalized(builder, translation.get("name")), pattern, '!'));
            predicates.add(builder.or(builder.like(normalized(builder, hero.get("code")), pattern, '!'),
                    builder.exists(ownerCopy), builder.exists(skillCopy)));
        }

        return new Selection(hero, revision, skill, predicates.toArray(Predicate[]::new));
    }

    private static Predicate sourceSlot(CriteriaBuilder builder, Root<SkillSnapshotRow> skill,
            SkillReferenceSearch search) {
        int slot = search.sourceSlot();
        if (search.variantNo() != null)
            return builder.equal(skill.get("skillKey"), "skill-" + slot + "-" + search.variantNo());

        var keys = builder.or(builder.like(skill.get("skillKey"), "skill-" + slot + "-%"),
                builder.equal(skill.get("skillKey"), slot == 0 ? "capture-passive" : "capture-skill-" + slot));
        return slot == 0 ? builder.or(keys, builder.equal(skill.get("kind"), "PASSIVE")) : keys;
    }

    private static Expression<String> normalized(CriteriaBuilder builder, Expression<String> text) {
        return builder.function("translate", String.class, builder.lower(text),
                builder.literal(SkillReferenceSearch.DIACRITICS), builder.literal(SkillReferenceSearch.PLAIN));
    }

    private static Expression<Long> ordinal(CriteriaBuilder builder, Path<UUID> patch, Map<UUID, Long> ordinals) {
        if (ordinals.isEmpty())
            return builder.literal(0L);

        var rank = builder.<UUID, Long>selectCase(patch);
        new TreeMap<>(ordinals).forEach(rank::when);
        return rank.otherwise(0L);
    }

    @Override
    public List<Copy> selectSkillCopies(List<Row> rows) {
        if (rows.isEmpty())
            return List.of();

        var builder = entities.getCriteriaBuilder();
        var query = builder.createQuery(Copy.class);
        var translation = query.from(SkillTranslationRow.class);
        var pairs = new ArrayList<Predicate>();
        for (var row : rows)
            pairs.add(builder.and(builder.equal(translation.get("skillSetRevisionId"), row.skillSetRevisionId()),
                    builder.equal(translation.get("skillKey"), row.skillKey())));

        query.select(builder.construct(Copy.class, translation.get("skillSetRevisionId"), translation.get("skillKey"),
                translation.get("locale"), translation.get("name"),
                builder.substring(builder.coalesce(translation.<String>get("description"), ""), 1, 4000)))
                .where(builder.or(pairs.toArray(Predicate[]::new)))
                .orderBy(builder.asc(translation.get("skillSetRevisionId")), builder.asc(translation.get("skillKey")),
                        builder.asc(translation.get("locale")));

        return entities.createQuery(query).getResultList();
    }

    private record Selection(
            Root<HeroIdentity> hero,
            Root<HeroRevision> revision,
            Root<SkillSnapshotRow> skill,
            Predicate[] predicates
    ) {
    }
}
