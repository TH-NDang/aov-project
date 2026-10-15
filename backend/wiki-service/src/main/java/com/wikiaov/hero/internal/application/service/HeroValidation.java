package com.wikiaov.hero.internal.application.service;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.HeroStore;
import com.wikiaov.media.*;
import com.wikiaov.platform.ApiException;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Component;
@Component
public class HeroValidation {
    private final MediaAssets media;
    private final Validator validator;
    private final HeroStore store;
    public HeroValidation(MediaAssets media, Validator validator, HeroStore store) {
        this.media = media;
        this.validator = validator;
        this.store = store;
    }
    public void validate(HeroSection section, Object value) {
        if (!validator.validate(value).isEmpty())
            throw invalid("The hero section is incomplete or invalid.");
        switch (section) {
            case PROFILE -> {
                var p = (Profile) value;
                unique(p.translations().stream().map(ProfileTranslation::locale).toList());
                p.translations().forEach(t -> locale(t.locale()));
            }
            case OVERVIEW_RATINGS -> {
                var p = (Ratings) value;
                var scale = store.rows("SELECT min_value,max_value FROM hero.rating_scale WHERE code=?", p.scaleCode());
                if (scale.isEmpty())
                    throw invalid("Unknown rating scale.");
                for (var rating : List.of(p.survivability(), p.attackDamage(), p.skillEffects(), p.difficulty()))
                    if (rating.compareTo((BigDecimal) scale.getFirst().get("min_value")) < 0
                            || rating.compareTo((BigDecimal) scale.getFirst().get("max_value")) > 0)
                        throw invalid("Rating is outside the scale.");
                if (p.derived() && p.sources().isEmpty())
                    throw invalid("Derived ratings require a source describing the method.");
            }
            case COMBAT_STATS -> {
                var p = (Stats) value;
                unique(p.values().stream().map(Stat::statKey).toList());
                if (p.values().stream().anyMatch(v -> v.baseValue() == null && v.growthPerLevel() == null))
                    throw invalid("A stat must have a numeric value.");
            }
            case SKILLS -> {
                var p = (Skills) value;
                unique(p.skills().stream().map(Skill::skillKey).toList());
                unique(p.skills().stream().map(Skill::displayOrder).toList());
                for (var skill : p.skills()) {
                    unique(skill.translations().stream().map(SkillTranslation::locale).toList());
                    skill.translations().forEach(t -> locale(t.locale()));
                    asset(skill.iconAssetId(), MediaSemanticType.HERO_SKILL_ICON);
                }
            }
            case SKINS -> {
                var p = (Skins) value;
                unique(p.skins().stream().map(Skin::skinKey).toList());
                unique(p.skins().stream().map(Skin::displayOrder).toList());
                for (var skin : p.skins()) {
                    unique(skin.translations().stream().map(SkinTranslation::locale).toList());
                    skin.translations().forEach(t -> locale(t.locale()));
                    asset(skin.artAssetId(), MediaSemanticType.HERO_SKIN_ART);
                }
            }
            case MEDIA_BINDINGS -> {
                var p = (Bindings) value;
                if (!p.bindings().keySet().equals(EnumSet.allOf(MediaRole.class)))
                    throw invalid("HEAD, PORTRAIT and SPLASH bindings are required.");
                p.bindings().forEach((role, id) -> asset(id, MediaSemanticType.valueOf("HERO_" + role.name())));
            }
        }
        List<Source> sources = switch (value) {
            case Profile v -> v.sources();
            case Ratings v -> v.sources();
            case Stats v -> v.sources();
            case Skills v -> v.sources();
            case Skins v -> v.sources();
            case Bindings v -> v.sources();
            default -> List.of();
        };
        for (var source : sources)
            if (source.sourceUrl() != null && !source.sourceUrl().matches("https?://[^\\s]+"))
                throw invalid("Source URL must use HTTP or HTTPS.");
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
