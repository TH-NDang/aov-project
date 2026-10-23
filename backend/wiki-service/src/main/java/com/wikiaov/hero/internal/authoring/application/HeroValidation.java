package com.wikiaov.hero.internal.authoring.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.ratings.persistence.RatingScaleRepository;
import com.wikiaov.media.*;
import com.wikiaov.platform.ApiException;
import jakarta.validation.Validator;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class HeroValidation {
    private final MediaAssets media;
    private final Validator validator;
    private final RatingScaleRepository scales;

    public HeroValidation(MediaAssets media, Validator validator, RatingScaleRepository scales) {
        this.media = media;
        this.validator = validator;
        this.scales = scales;
    }

    public void validate(HeroSection section, Object value) {
        if (value == null || !validator.validate(value).isEmpty())
            throw invalid("The hero section is incomplete or invalid.");

        switch (section) {
            case PROFILE -> validateProfile((Profile) value);
            case OVERVIEW_RATINGS -> validateRatings((Ratings) value);
            case COMBAT_STATS -> validateStats((Stats) value);
            case SKILLS -> validateSkills((Skills) value);
            case SKINS -> validateSkins((Skins) value);
            case MEDIA_BINDINGS -> validateBindings((Bindings) value);
        }

        validateSources(value);
    }

    private void validateProfile(Profile profile) {
        unique(profile.translations().stream().map(ProfileTranslation::locale).toList());
        profile.translations().forEach(text -> locale(text.locale()));
    }

    private void validateRatings(Ratings ratings) {
        var scale = scales.findById(ratings.scaleCode());
        if (scale.isEmpty())
            throw invalid("Unknown rating scale.");

        var range = scale.orElseThrow();
        for (var rating : List.of(ratings.survivability(), ratings.attackDamage(), ratings.skillEffects(),
                ratings.difficulty()))
            if (rating.compareTo(range.getMinValue()) < 0 || rating.compareTo(range.getMaxValue()) > 0)
                throw invalid("Rating is outside the scale.");

        if (ratings.derived() && ratings.sources().isEmpty())
            throw invalid("Derived ratings require a source describing the method.");
    }

    private void validateStats(Stats stats) {
        unique(stats.values().stream().map(Stat::statKey).toList());

        if (stats.values().stream().anyMatch(value -> value.baseValue() == null && value.growthPerLevel() == null))
            throw invalid("A stat must have a numeric value.");
    }

    private void validateSkills(Skills skills) {
        unique(skills.skills().stream().map(Skill::skillKey).toList());
        unique(skills.skills().stream().map(Skill::displayOrder).toList());

        for (var skill : skills.skills()) {
            unique(skill.translations().stream().map(SkillTranslation::locale).toList());
            skill.translations().forEach(text -> locale(text.locale()));

            asset(skill.iconAssetId(), MediaSemanticType.HERO_SKILL_ICON);
        }
    }

    private void validateSkins(Skins skins) {
        unique(skins.skins().stream().map(Skin::skinKey).toList());
        unique(skins.skins().stream().map(Skin::displayOrder).toList());

        for (var skin : skins.skins()) {
            unique(skin.translations().stream().map(SkinTranslation::locale).toList());
            skin.translations().forEach(text -> locale(text.locale()));

            asset(skin.artAssetId(), MediaSemanticType.HERO_SKIN_ART);
            asset(skin.headAssetId(), MediaSemanticType.HERO_SKIN_ART);
            asset(skin.portraitAssetId(), MediaSemanticType.HERO_SKIN_ART);
            images(skin.images(), true);
        }
    }

    private void validateBindings(Bindings bindings) {
        bindings.bindings().forEach((role, id) -> asset(id, MediaSemanticType.valueOf("HERO_" + role.name())));
        images(bindings.images(), false);
    }

    private static void validateSources(Object value) {
        List<Source> sources = switch (value) {
            case Profile content -> content.sources();
            case Ratings content -> content.sources();
            case Stats content -> content.sources();
            case Skills content -> content.sources();
            case Skins content -> content.sources();
            case Bindings content -> content.sources();
            default -> List.of();
        };

        for (var source : sources)
            if (source.sourceUrl() != null && !source.sourceUrl().matches("https?://[^\\s]+"))
                throw invalid("Source URL must use HTTP or HTTPS.");
    }

    private void images(Map<MediaRole, List<ImageOption>> images, boolean skin) {
        images.forEach((role, options) -> {
            unique(options.stream().map(ImageOption::assetId).toList());
            options.forEach(option -> asset(option.assetId(), skin
                    ? MediaSemanticType.HERO_SKIN_ART
                    : MediaSemanticType.valueOf("HERO_" + role.name())));
        });
    }

    public void validatePublication(HeroSection section, Object value) {
        validate(section, value);

        var errors = validator.validate(value, Publication.class).stream()
                .map(v -> new com.wikiaov.platform.ApiFieldError(section.name() + "." + v.getPropertyPath(),
                        "HERO_PUBLICATION_REQUIRED", "This field is required for publication."))
                .sorted(Comparator.comparing(com.wikiaov.platform.ApiFieldError::path)).toList();
        if (!errors.isEmpty())
            throw new ApiException(HeroErrorCode.HERO_INVALID_CONTENT,
                    "Complete the required fields before publishing.", errors);
    }

    private void asset(UUID id, MediaSemanticType type) {
        if (id == null)
            return;

        var ref = media.find(id).orElseThrow(
                () -> new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "The media asset does not exist."));
        if (!ref.usable() || ref.semanticType() != type)
            throw new ApiException(HeroErrorCode.HERO_INVALID_MEDIA, "The asset is not usable for this semantic role.");
    }

    public static void locale(String value) {
        try {
            var locale = new Locale.Builder().setLanguageTag(value).build();
            if (locale.getLanguage().isEmpty() || !locale.toLanguageTag().equals(value))
                throw invalid("Use a canonical BCP 47 locale.");
        } catch (IllformedLocaleException e) {
            throw invalid("Use a canonical BCP 47 locale.");
        }
    }

    private static void unique(List<?> keys) {
        if (new HashSet<>(keys).size() != keys.size())
            throw invalid("Section keys, locales and display orders must be unique.");
    }

    public static ApiException invalid(String detail) {
        return new ApiException(HeroErrorCode.HERO_INVALID_CONTENT, detail);
    }
}
