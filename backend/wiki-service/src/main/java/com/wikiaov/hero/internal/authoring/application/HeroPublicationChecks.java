package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormGameplay;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.hero.internal.stats.domain.HeroStatObservations;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import java.util.EnumSet;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

/** What a hero draft needs before {@link HeroAuthoring} publishes it. */
@Component
public class HeroPublicationChecks {
    private final HeroSections sections;
    private final HeroValidation validation;
    private final GameplayContexts contexts;
    private final HeroForms forms;
    private final HeroRevisionContexts revisionContexts;

    public HeroPublicationChecks(HeroSections sections, HeroValidation validation, GameplayContexts contexts,
            HeroForms forms, HeroRevisionContexts revisionContexts) {
        this.sections = sections;
        this.validation = validation;
        this.contexts = contexts;
        this.forms = forms;
        this.revisionContexts = revisionContexts;
    }

    /** Roles, positions, ratings, stats and skills of a hero that holds forms belong to its forms (ADR-024). */
    static ApiException formGameplay(HeroSection section) {
        return new ApiException(HeroErrorCode.HERO_FORM_PARENT_GAMEPLAY,
                "Roles, positions, ratings, stats and skills belong to the hero's forms.",
                Map.of("section", section.name()));
    }

    void check(HeroRevisionView draft) {
        revisionContexts.check(draft.rulesetId(), draft.cause(), draft.effectiveFromPatchVariantId(), true);
        if (draft.sections().size() != HeroSection.values().length) {
            throw HeroValidation.invalid("All hero sections are required.");
        }
        if (forms.holdsForms(draft.heroId())) {
            checkHolder(draft);
            return;
        }
        var skills = (Skills) sections.content(HeroSection.SKILLS, draft.sections().get(HeroSection.SKILLS));
        for (var section : HeroSection.values()) {
            var value = section == HeroSection.SKILLS
                    ? skills
                    : sections.content(section, draft.sections().get(section));
            if (value instanceof Stats stats && stats.values().isEmpty() && draft.effectiveFromPatchVariantId() != null
                    && HeroStatObservations.hasReadings(skills,
                            contexts.patchCode(draft.effectiveFromPatchVariantId()))) {
                validation.validate(section, stats);
            } else {
                validation.validatePublication(section, value);
            }
        }

        requireCardImages(draft);

        var profile = (Profile) sections.content(HeroSection.PROFILE, draft.sections().get(HeroSection.PROFILE));
        var locales = profile.translations().stream().map(ProfileTranslation::locale)
                .collect(Collectors.toSet());
        if (skills.skills().stream().anyMatch(s -> !s.translations().stream().map(SkillTranslation::locale)
                .collect(Collectors.toSet()).containsAll(locales))) {
            throw HeroValidation.invalid("Every skill needs translations for all profile locales.");
        }
    }

    /**
     * A hero that holds forms publishes only what its forms share (ADR-024): names, title, lore, shared skins and the
     * three card images. Gameplay sections stay empty, so their publication requirements do not apply.
     */
    private void checkHolder(HeroRevisionView draft) {
        for (var section : HeroSection.values()) {
            var value = sections.content(section, draft.sections().get(section));
            if (HeroFormGameplay.present(value)) {
                throw formGameplay(section);
            }
            if (section == HeroSection.PROFILE) {
                validation.validate(section, value);
            } else if (section == HeroSection.SKINS || section == HeroSection.MEDIA_BINDINGS) {
                validation.validatePublication(section, value);
            }
        }

        requireCardImages(draft);
    }

    private void requireCardImages(HeroRevisionView draft) {
        var bindings = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                draft.sections().get(HeroSection.MEDIA_BINDINGS));
        if (!bindings.bindings().keySet().equals(EnumSet.allOf(MediaRole.class))) {
            throw HeroValidation.invalid("HEAD, PORTRAIT and SPLASH bindings are required for publication.");
        }
    }
}
