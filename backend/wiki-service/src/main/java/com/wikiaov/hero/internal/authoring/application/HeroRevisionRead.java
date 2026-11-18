package com.wikiaov.hero.internal.authoring.application;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Ratings;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import java.util.Map;
import org.jspecify.annotations.Nullable;

/** A revision as editors read it: its header and the stored content of every section it holds (03, hero authoring). */
public record HeroRevisionRead(
        HeroRevisionView revision,
        Content content
) {

    /**
     * The stored content of each section, sources and every translation included. A section the revision does not
     * hold yet is left out.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record Content(
            @Nullable Profile profile,
            @Nullable Ratings overviewRatings,
            @Nullable Stats combatStats,
            @Nullable Skills skills,
            @Nullable Skins skins,
            @Nullable Bindings mediaBindings
    ) {
        static Content of(Map<HeroSection, Object> sections) {
            return new Content((Profile) sections.get(HeroSection.PROFILE),
                    (Ratings) sections.get(HeroSection.OVERVIEW_RATINGS),
                    (Stats) sections.get(HeroSection.COMBAT_STATS), (Skills) sections.get(HeroSection.SKILLS),
                    (Skins) sections.get(HeroSection.SKINS), (Bindings) sections.get(HeroSection.MEDIA_BINDINGS));
        }
    }
}
