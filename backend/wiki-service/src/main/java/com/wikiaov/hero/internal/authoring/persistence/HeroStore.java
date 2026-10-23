package com.wikiaov.hero.internal.authoring.persistence;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.platform.ApiException;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;

@Repository
public class HeroStore {
    private final HeroIdentityRepository heroes;
    private final HeroRevisionRepository revisions;

    public HeroStore(HeroIdentityRepository heroes, HeroRevisionRepository revisions) {
        this.heroes = heroes;
        this.revisions = revisions;
    }

    public HeroIdentity hero(UUID id) {
        return heroes.findById(id).orElseThrow();
    }

    public List<HeroIdentity> heroes(boolean descending) {
        return heroes.findAll(Sort.by(descending ? Sort.Direction.DESC : Sort.Direction.ASC, "code"));
    }

    public boolean publishedSectionExists(HeroSection section, UUID id) {
        return switch (section) {
            case PROFILE -> revisions.existsByStateAndProfileRevisionId("PUBLISHED", id);
            case OVERVIEW_RATINGS -> revisions.existsByStateAndOverviewRatingRevisionId("PUBLISHED", id);
            case COMBAT_STATS -> revisions.existsByStateAndCombatStatsRevisionId("PUBLISHED", id);
            case SKILLS -> revisions.existsByStateAndSkillsRevisionId("PUBLISHED", id);
            case SKINS -> revisions.existsByStateAndSkinsRevisionId("PUBLISHED", id);
            case MEDIA_BINDINGS -> revisions.existsByStateAndMediaBindingRevisionId("PUBLISHED", id);
        };
    }

    public void lockHero(UUID heroId) {
        heroes.lockById(heroId).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                "The hero does not exist."));
    }

    public com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision editableEntity(UUID id) {
        return revisions.findById(id).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND,
                "The hero revision does not exist."));
    }

    public void insert(HeroIdentity hero) {
        heroes.saveAndFlush(hero);
    }

    public void insert(HeroRevision revision) {
        revisions.saveAndFlush(revision);
    }

    public HeroRevisionView revision(UUID heroId, UUID id) {
        return revisions.findByHeroIdAndId(heroId, id).map(this::view).orElseThrow(
                () -> new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND, "The hero revision does not exist."));
    }

    public List<HeroRevisionView> revisions(UUID heroId) {
        return revisions.findByHeroIdOrderByRevisionNoDesc(heroId).stream().map(this::view).toList();
    }

    public List<HeroRevisionView> revisions(Collection<UUID> heroIds) {
        return revisions.findByHeroIdInOrderByRevisionNoDesc(heroIds).stream().map(this::view).toList();
    }

    private HeroRevisionView view(com.wikiaov.hero.internal.authoring.persistence.entity.HeroRevision r) {
        Map<HeroSection, UUID> sections = new EnumMap<>(HeroSection.class);
        put(sections, HeroSection.PROFILE, r.getProfileRevisionId());
        put(sections, HeroSection.OVERVIEW_RATINGS, r.getOverviewRatingRevisionId());
        put(sections, HeroSection.COMBAT_STATS, r.getCombatStatsRevisionId());
        put(sections, HeroSection.SKILLS, r.getSkillsRevisionId());
        put(sections, HeroSection.SKINS, r.getSkinsRevisionId());
        put(sections, HeroSection.MEDIA_BINDINGS, r.getMediaBindingRevisionId());
        return new HeroRevisionView(r.getId(), r.getHeroId(), r.getRulesetId(), r.getRevisionNo(), r.getState(),
                r.getVersion(), r.getPublicationSequence(), r.getPublishedAt(), Cause.valueOf(r.getCause()),
                r.getSourceRevisionId(), r.getEffectiveFromPatchVariantId(), sections);
    }

    private static void put(Map<HeroSection, UUID> target, HeroSection section, UUID value) {
        if (value != null)
            target.put(section, value);
    }
}
