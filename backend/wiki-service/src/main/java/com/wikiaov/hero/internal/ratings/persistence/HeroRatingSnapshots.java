package com.wikiaov.hero.internal.ratings.persistence;

import com.wikiaov.access.Actor;
import com.wikiaov.hero.internal.domain.HeroContent.Ratings;
import com.wikiaov.hero.internal.domain.HeroContent.Source;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.ratings.persistence.entity.RatingRevision;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionLifecycle;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSectionSources;
import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
    public com.wikiaov.hero.internal.sections.persistence.SectionRevisionRepository<?> revisions() {
        return revisions;
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
        var rating = revisions.findById(id).orElse(null);
        return ratings(rating, sources.find(section(), id));
    }

    /** Reads many snapshots in a bounded number of queries, for lists that cover every hero. */
    public Map<UUID, Ratings> contents(Collection<UUID> ids) {
        var references = sources.find(section(), ids);
        Map<UUID, Ratings> result = new HashMap<>();
        for (var rating : revisions.findAllById(ids))
            result.put(rating.getId(), ratings(rating, references.getOrDefault(rating.getId(), List.of())));
        return result;
    }

    private static Ratings ratings(RatingRevision rating, List<Source> references) {
        return new Ratings(rating.getScaleCode(), rating.getSurvivability(), rating.getAttackDamage(),
                rating.getSkillEffects(), rating.getDifficulty(), rating.isDerived(), references);
    }

    @Override
    public void publish(UUID id, UUID heroId) {
        lifecycle.publish(revisions, id, heroId);
    }
}
