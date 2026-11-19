package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Effect;
import com.wikiaov.hero.internal.domain.HeroContent.ImageOption;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Ratings;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Skill;
import com.wikiaov.hero.internal.domain.HeroContent.SkillKind;
import com.wikiaov.hero.internal.domain.HeroContent.SkillStateIcon;
import com.wikiaov.hero.internal.domain.HeroContent.SkillTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skin;
import com.wikiaov.hero.internal.domain.HeroContent.SkinTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroContent.Stat;
import com.wikiaov.hero.internal.domain.HeroContent.Stats;
import com.wikiaov.hero.internal.domain.HeroContent.Trait;
import com.wikiaov.hero.internal.domain.HeroContent.TraitCode;
import com.wikiaov.hero.internal.domain.HeroContent.TraitTranslation;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogLocales;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The published section pages readers fetch by revision (03, hero sections). A page leaves out the sources and keeps
 * one translation of each text: the requested locale, or the fallback {@link CatalogLocales#pick} chooses, named in
 * {@code actualLocale}.
 */
@Service
@Transactional(readOnly = true)
public class HeroSectionPages {
    private final HeroStore store;
    private final HeroSections sections;

    public HeroSectionPages(HeroStore store, HeroSections sections) {
        this.store = store;
        this.sections = sections;
    }

    public ProfilePage profile(UUID id, String locale) {
        return new ProfilePage(id, profile((Profile) published(HeroSection.PROFILE, id, locale), locale));
    }

    public RatingsPage ratings(UUID id, String locale) {
        return new RatingsPage(id, ratings((Ratings) published(HeroSection.OVERVIEW_RATINGS, id, locale)));
    }

    public StatsPage stats(UUID id, String locale) {
        return new StatsPage(id, new StatsContent(((Stats) published(HeroSection.COMBAT_STATS, id, locale)).values()));
    }

    public SkillsPage skills(UUID id, String locale) {
        return new SkillsPage(id, skills((Skills) published(HeroSection.SKILLS, id, locale), locale));
    }

    public SkinsPage skins(UUID id, String locale) {
        return new SkinsPage(id, skins((Skins) published(HeroSection.SKINS, id, locale), locale));
    }

    public BindingsPage bindings(UUID id, String locale) {
        return new BindingsPage(id, bindings((Bindings) published(HeroSection.MEDIA_BINDINGS, id, locale)));
    }

    /** The page content of one stored section, as the hero detail embeds it. */
    static Object content(HeroSection section, Object stored, String locale) {
        return switch (section) {
            case PROFILE -> profile((Profile) stored, locale);
            case OVERVIEW_RATINGS -> ratings((Ratings) stored);
            case COMBAT_STATS -> new StatsContent(((Stats) stored).values());
            case SKILLS -> skills((Skills) stored, locale);
            case SKINS -> skins((Skins) stored, locale);
            case MEDIA_BINDINGS -> bindings((Bindings) stored);
        };
    }

    private Object published(HeroSection section, UUID id, String locale) {
        HeroValidation.locale(locale);
        if (!store.publishedSectionExists(section, id)) {
            throw new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND, "No published section exists with this ID.");
        }

        return sections.content(section, id);
    }

    private static ProfileContent profile(Profile profile, String locale) {
        var text = pick(profile.translations(), ProfileTranslation::locale, locale);

        var value = text.value();
        return new ProfileContent(profile.roles(), profile.positions(), value.name(), value.title(), value.summary(),
                value.lore(), value.strengths(), value.weaknesses(), value.counterTips(), text.actualLocale(),
                text.fallbackApplied());
    }

    private static RatingsContent ratings(Ratings ratings) {
        return new RatingsContent(ratings.scaleCode(), ratings.survivability(), ratings.attackDamage(),
                ratings.skillEffects(), ratings.difficulty(), ratings.derived());
    }

    private static SkillsContent skills(Skills skills, String locale) {
        var entries = skills.skills().stream().map(skill -> skill(skill, locale)).toList();
        var traits = skills.traits() == null
                ? null
                : skills.traits().stream().map(trait -> trait(trait, locale)).toList();

        return new SkillsContent(entries, traits);
    }

    private static SkinsContent skins(Skins skins, String locale) {
        return new SkinsContent(skins.skins().stream().map(skin -> skin(skin, locale)).toList());
    }

    private static BindingsContent bindings(Bindings bindings) {
        return new BindingsContent(bindings.bindings(), bindings.images());
    }

    private static SkillContent skill(Skill skill, String locale) {
        var text = pick(skill.translations(), SkillTranslation::locale, locale);

        var value = text.value();
        return new SkillContent(skill.skillKey(), skill.kind(), skill.formKey(), skill.displayOrder(),
                skill.iconAssetId(), skill.effects(), skill.stateIcons(), value.name(), value.description(),
                value.summary(), text.actualLocale(), text.fallbackApplied());
    }

    /** A trait may have no detail line yet; it is still shown, without one. */
    private static TraitContent trait(Trait trait, String locale) {
        if (trait.translations() == null || trait.translations().isEmpty()) {
            return new TraitContent(trait.code(), trait.skillKeys(), null, null, false);
        }

        var text = pick(trait.translations(), TraitTranslation::locale, locale);
        return new TraitContent(trait.code(), trait.skillKeys(), text.value().detail(), text.actualLocale(),
                text.fallbackApplied());
    }

    private static SkinContent skin(Skin skin, String locale) {
        var text = pick(skin.translations(), SkinTranslation::locale, locale);

        var value = text.value();
        return new SkinContent(skin.skinKey(), skin.displayOrder(), skin.artAssetId(), skin.rarityCode(),
                skin.headAssetId(), skin.portraitAssetId(), skin.images(), value.name(), value.description(),
                value.acquisitionNote(), text.actualLocale(), text.fallbackApplied());
    }

    private static <T> Picked<T> pick(List<T> translations, Function<T, String> localeOf, String requested) {
        var value = CatalogLocales.pick(translations, requested, localeOf);
        if (value == null) {
            throw HeroValidation.invalid("A published section has no translation.");
        }

        String actual = localeOf.apply(value);
        return new Picked<>(value, actual, !requested.equals(actual));
    }

    private record Picked<T>(
            T value,
            String actualLocale,
            boolean fallbackApplied
    ) {
    }

    public record ProfilePage(
            UUID id,
            ProfileContent content
    ) {
    }

    public record ProfileContent(
            Set<Role> roles,
            Set<Position> positions,
            String name,
            @Nullable String title,
            @Nullable String summary,
            @Nullable String lore,
            @Nullable String strengths,
            @Nullable String weaknesses,
            @Nullable String counterTips,
            String actualLocale,
            boolean fallbackApplied
    ) {
    }

    public record RatingsPage(
            UUID id,
            RatingsContent content
    ) {
    }

    public record RatingsContent(
            String scaleCode,
            BigDecimal survivability,
            BigDecimal attackDamage,
            BigDecimal skillEffects,
            BigDecimal difficulty,
            boolean derived
    ) {
    }

    public record StatsPage(
            UUID id,
            StatsContent content
    ) {
    }

    public record StatsContent(
            List<Stat> values
    ) {
    }

    public record SkillsPage(
            UUID id,
            SkillsContent content
    ) {
    }

    /** @param traits the confirmed traits, or {@code null} for a section written before traits existed */
    public record SkillsContent(
            List<SkillContent> skills,
            @Nullable List<TraitContent> traits
    ) {
    }

    public record SkillContent(
            String skillKey,
            SkillKind kind,
            @Nullable String formKey,
            int displayOrder,
            @Nullable UUID iconAssetId,
            List<Effect> effects,
            List<SkillStateIcon> stateIcons,
            String name,
            String description,
            @Nullable String summary,
            String actualLocale,
            boolean fallbackApplied
    ) {
    }

    /** @param actualLocale the locale of the detail line, or {@code null} when the trait has none */
    public record TraitContent(
            TraitCode code,
            List<String> skillKeys,
            @Nullable String detail,
            @Nullable String actualLocale,
            boolean fallbackApplied
    ) {
    }

    public record SkinsPage(
            UUID id,
            SkinsContent content
    ) {
    }

    public record SkinsContent(
            List<SkinContent> skins
    ) {
    }

    public record SkinContent(
            String skinKey,
            int displayOrder,
            @Nullable UUID artAssetId,
            @Nullable String rarityCode,
            @Nullable UUID headAssetId,
            @Nullable UUID portraitAssetId,
            Map<MediaRole, List<ImageOption>> images,
            String name,
            @Nullable String description,
            @Nullable String acquisitionNote,
            String actualLocale,
            boolean fallbackApplied
    ) {
    }

    public record BindingsPage(
            UUID id,
            BindingsContent content
    ) {
    }

    public record BindingsContent(
            Map<MediaRole, UUID> bindings,
            Map<MediaRole, List<ImageOption>> images
    ) {
    }
}
