package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.domain.SkillReferenceSearch;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/** Adapts paged reference identities and batched localized copy to the application read contract. */
@Repository
public class HeroSkillReferenceRepository {
    private final HeroSkillReferenceProjectionRepository queries;

    public HeroSkillReferenceRepository(HeroSkillReferenceProjectionRepository queries) {
        this.queries = queries;
    }

    public record Row(
            UUID heroId,
            String code,
            UUID revisionId,
            UUID profileRevisionId,
            UUID skillSetRevisionId,
            UUID headAssetId,
            String skillKey,
            String formKey,
            UUID iconAssetId
    ) {
    }

    public record Result(
            List<Row> items,
            long totalElements
    ) {
    }

    public record Copy(
            UUID sectionId,
            String skillKey,
            String locale,
            String name,
            String description
    ) {
    }

    public Result search(UUID rulesetId, Map<UUID, Long> ordinals, Instant at, Long cutoff,
            SkillReferenceSearch search, UUID heroId, List<String> ids, int page, int size) {
        return search(rulesetId, ordinals, at, cutoff, search, heroId, ids, page, size, true);
    }

    public Result search(UUID rulesetId, Map<UUID, Long> ordinals, Instant at, Long cutoff,
            SkillReferenceSearch search, UUID heroId, List<String> ids, int page, int size, boolean allowUnscoped) {
        return queries.selectSkills(new SkillReferenceCriteria(rulesetId, ordinals, at, cutoff, search, heroId, ids,
                page, size, allowUnscoped));
    }

    public List<Copy> skills(List<Row> rows) {
        return queries.selectSkillCopies(rows);
    }

    public List<Copy> owners(List<Row> rows) {
        if (rows.isEmpty())
            return List.of();

        var profiles = rows.stream().map(Row::profileRevisionId).filter(Objects::nonNull).distinct().toList();
        return queries.findOwnerCopies(profiles).stream()
                .map(copy -> new Copy(copy.getSectionId(), null, copy.getLocale(), copy.getName(), "")).toList();
    }
}
