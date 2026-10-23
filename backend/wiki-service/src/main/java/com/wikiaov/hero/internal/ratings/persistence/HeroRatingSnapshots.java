package com.wikiaov.hero.internal.ratings.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.ratings.persistence.entity.RatingRevision;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import java.time.Instant;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class HeroRatingSnapshots implements HeroSectionSnapshots {
    private final RatingRevisionRepository revisions;

    private final HeroSectionLifecycle lifecycle;
    private final HeroSectionSources sources;

    @Override
    public HeroSection section() {
        return HeroSection.OVERVIEW_RATINGS;
    }

    @Override
    public UUID create(UUID heroId, Object content, Actor actor, Instant at) {
        var revision = lifecycle.create(revisions, new RatingRevision(), heroId, actor, at);
        if (content != null) {
            var value = (Ratings) content;
            revision.setScaleCode(value.scaleCode());
            revision.setSurvivability(value.survivability());
            revision.setAttackDamage(value.attackDamage());
            revision.setSkillEffects(value.skillEffects());
            revision.setDifficulty(value.difficulty());
            revision.setDerived(value.derived());
            sources.save(section(), revision.getId(), value.sources());
        }
        revisions.flush();
        return revision.getId();
    }

    @Override
    public Ratings content(UUID id) {
        var references = sources.find(section(), id);
        var rating = revisions.findById(id).orElse(null);
        return new Ratings(rating.getScaleCode(), rating.getSurvivability(), rating.getAttackDamage(),
                rating.getSkillEffects(), rating.getDifficulty(), rating.isDerived(), references);
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
