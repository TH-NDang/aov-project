package com.wikiaov.hero.internal.reference.persistence;

import com.wikiaov.hero.internal.domain.SkillReferenceSearch;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public record SkillReferenceCriteria(
        UUID rulesetId,
        Map<UUID, Long> ordinals,
        Instant at,
        Long cutoff,
        SkillReferenceSearch search,
        UUID heroId,
        List<String> ids,
        int page,
        int size
) {
    public boolean published() {
        return cutoff != null;
    }

    public long offset() {
        return (long) page * size;
    }
}
