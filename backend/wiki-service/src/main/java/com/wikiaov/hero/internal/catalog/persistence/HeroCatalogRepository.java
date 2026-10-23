package com.wikiaov.hero.internal.catalog.persistence;

import com.wikiaov.hero.internal.authoring.persistence.HeroIdentityRepository;
import com.wikiaov.hero.internal.authoring.persistence.HeroRevisionRepository;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.change.persistence.HeroChangeClassificationRepository;
import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeSetRepository;
import com.wikiaov.hero.internal.change.persistence.HeroPatchChangeTranslationRepository;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import com.wikiaov.platform.PageSlice;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroCatalogRepository {
    private final HeroIdentityRepository heroes;
    private final HeroRevisionRepository revisions;
    private final HeroPatchChangeSetRepository changes;
    private final HeroChangeClassificationRepository classifications;
    private final HeroPatchChangeTranslationRepository translations;

    public record Filter(
            String q,
            UUID rulesetId,
            Set<UUID> variants,
            Map<UUID, Long> ordinals,
            boolean changesOnly,
            Set<UUID> snapshotVariants
    ) {
    }

    public PageSlice<HeroIdentity> page(Filter filter, int page, int size, boolean editedFirst) {
        var selected = heroes.findAll(HeroCatalogSpecifications.matching(filter, editedFirst),
                PageRequest.of(page, size));
        return new PageSlice<>(selected.getContent(), page, size, selected.getTotalElements());
    }

    public Map<UUID, Instant> editedTimes(Collection<UUID> heroIds) {
        Map<UUID, Instant> result = new HashMap<>();
        revisions.editedTimes(heroIds).forEach(row -> result.put(row.getHeroId(), row.getUpdatedAt()));
        return result;
    }

    public List<HeroPatchChangeSet> changes(Collection<UUID> heroIds, Collection<UUID> variants) {
        return changes.findByHeroIdInAndPatchVariantIdIn(heroIds, variants);
    }

    public List<HeroChangeClassificationRepository.Kind> classifications(Collection<UUID> changeSets) {
        return classifications.kinds(changeSets);
    }

    public List<HeroPatchChangeTranslation> translations(Collection<UUID> changeSets) {
        return translations.findByChangeSetIdIn(changeSets);
    }
}
