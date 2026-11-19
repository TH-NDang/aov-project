package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.hero.internal.skills.application.SkillLibraryIcons;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContext;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/** The page readers see of one published hero: its sections, media and forms, and the context it was read in. */
@Component
public class HeroDetails {
    private final HeroStore store;
    private final HeroSections sections;
    private final MediaAssets media;
    private final HeroForms forms;
    private final SkillLibraryIcons libraryIcons;
    private final HeroReaderSelection selection;

    public HeroDetails(HeroStore store, HeroSections sections, MediaAssets media, HeroForms forms,
            SkillLibraryIcons libraryIcons, HeroReaderSelection selection) {
        this.store = store;
        this.sections = sections;
        this.media = media;
        this.forms = forms;
        this.libraryIcons = libraryIcons;
        this.selection = selection;
    }

    static String sectionKey(HeroSection s) {
        return switch (s) {
            case PROFILE -> "profile";
            case OVERVIEW_RATINGS -> "overviewRatings";
            case COMBAT_STATS -> "combatStats";
            case SKILLS -> "skills";
            case SKINS -> "skins";
            case MEDIA_BINDINGS -> "mediaBindings";
        };
    }

    /** The page of the chosen revision; {@code manifest} leaves out section content and media. */
    Map<String, Object> page(UUID heroId, HeroReadMoments.Choice<HeroRevisionView> choice,
            HeroReadMoments.Moment moment, Instant at, String locale, boolean manifest) {
        var result = detail(choice.revision(), moment.context(), locale, manifest);
        markLaterObservation(result, choice);
        addForms(result, heroId, moment, at, locale, manifest);
        return result;
    }

    private void markLaterObservation(Map<String, Object> entry, HeroReadMoments.Choice<?> choice) {
        var later = selection.laterObservation(choice);
        if (later != null) {
            entry.put("laterObservation", later);
        }
    }

    /**
     * A hero that holds forms lists each form published in the same context, in switcher order and with the same detail
     * as any hero. A form names the hero that holds it, so readers can be sent to the holding page (ADR-024).
     */
    @SuppressWarnings("unchecked")
    private void addForms(Map<String, Object> result, UUID heroId, HeroReadMoments.Moment moment, Instant at,
            String locale, boolean manifest) {
        var structure = forms.structure();
        if (structure.holdsForms(heroId)) {
            List<Map<String, Object>> entries = new ArrayList<>();
            for (var form : structure.formsOf(heroId)) {
                selection.choose(form.heroId(), moment, at).ifPresent(formChoice -> {
                    var entry = detail(formChoice.revision(), moment.context(), locale, manifest);
                    markLaterObservation(entry, formChoice);
                    var formContext = (Map<String, Object>) entry.remove("context");
                    entry.put("formKey", form.formKey());
                    entry.put("displayOrder", form.displayOrder());
                    entry.put("actualLocale", formContext.get("actualLocale"));
                    entry.put("fallbackApplied", formContext.get("fallbackApplied"));
                    entries.add(entry);
                });
            }
            result.put("forms", entries);
        }
        structure.form(heroId)
                .ifPresent(form -> result.put("parent", parent(form, store.requireHero(form.holderId()))));
    }

    private static Map<String, Object> parent(HeroFormStructure.Form form, HeroIdentity holder) {
        return Map.of("id", holder.getId(), "code", holder.getCode(), "formKey", form.formKey());
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> detail(HeroRevisionView rev, GameplayContext ctx, String locale, boolean manifest) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("context", context(ctx, locale));
        result.put("id", rev.heroId());
        result.put("revisionId", rev.id());
        result.put("code", store.requireHero(rev.heroId()).getCode());
        result.put("unscopedBaseline", rev.effectiveFromPatchVariantId() == null);

        Map<String, Object> refs = new LinkedHashMap<>();
        rev.sections().forEach((s, id) -> refs.put(sectionKey(s), id));
        result.put("sections", refs);

        if (!manifest) {
            Map<String, Object> content = new LinkedHashMap<>();
            rev.sections().forEach((s, id) -> content.put(sectionKey(s),
                    HeroSectionPages.content(s, sections.content(s, id), locale)));
            result.put("content", content);

            addHeroMedia(result, rev);
            addSkillMedia(result, rev);
            addSkinMedia(result, rev);
        }

        var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
        String actual = HeroReaderSelection.profileLocale(profile, locale);
        ((Map<String, Object>) result.get("context")).put("actualLocale", actual);
        ((Map<String, Object>) result.get("context")).put("fallbackApplied", !locale.equals(actual));

        return result;
    }

    private void addHeroMedia(Map<String, Object> result, HeroRevisionView rev) {
        var bindings = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                rev.sections().get(HeroSection.MEDIA_BINDINGS));
        Map<String, Object> assets = new LinkedHashMap<>();
        bindings.bindings().forEach(
                (role, id) -> media.find(id).filter(a -> a.usable()).ifPresent(a -> assets.put(role.name(), a)));

        result.put("media", assets);
    }

    private void addSkillMedia(Map<String, Object> result, HeroRevisionView rev) {
        Map<String, Object> skillMedia = new LinkedHashMap<>();
        // State icons are keyed by asset, since the content lists them by asset ID under each skill.
        Map<String, Object> skillStateMedia = new LinkedHashMap<>();
        var skills = (Skills) sections.content(HeroSection.SKILLS, rev.sections().get(HeroSection.SKILLS));
        // A skill without an icon of its own shows the hero's library picture, as it does in Admin.
        var library = libraryIcons.forSkills(rev.heroId(), skills.skills());
        skills.skills().forEach(skill -> {
            var iconId = skill.iconAssetId() != null ? skill.iconAssetId() : library.get(skill.skillKey());
            if (iconId != null) {
                media.find(iconId).filter(a -> a.usable()).ifPresent(a -> skillMedia.put(skill.skillKey(), a));
            }
            skill.stateIcons().forEach(icon -> media.find(icon.assetId()).filter(a -> a.usable())
                    .ifPresent(a -> skillStateMedia.put(icon.assetId().toString(), a)));
        });

        result.put("skillMedia", skillMedia);
        result.put("skillStateMedia", skillStateMedia);
    }

    private void addSkinMedia(Map<String, Object> result, HeroRevisionView rev) {
        Map<String, Object> skinMedia = new LinkedHashMap<>();
        Map<String, Object> skinHeadMedia = new LinkedHashMap<>();
        Map<String, Object> skinPortraitMedia = new LinkedHashMap<>();
        var skins = (Skins) sections.content(HeroSection.SKINS, rev.sections().get(HeroSection.SKINS));
        skins.skins().forEach(skin -> {
            if (skin.artAssetId() != null) {
                media.find(skin.artAssetId()).filter(a -> a.usable())
                        .ifPresent(a -> skinMedia.put(skin.skinKey(), a));
            }
            if (skin.headAssetId() != null) {
                media.find(skin.headAssetId()).filter(a -> a.usable())
                        .ifPresent(a -> skinHeadMedia.put(skin.skinKey(), a));
            }
            if (skin.portraitAssetId() != null) {
                media.find(skin.portraitAssetId()).filter(a -> a.usable())
                        .ifPresent(a -> skinPortraitMedia.put(skin.skinKey(), a));
            }
        });

        result.put("skinMedia", skinMedia);
        result.put("skinHeadMedia", skinHeadMedia);
        result.put("skinPortraitMedia", skinPortraitMedia);
    }

    private Map<String, Object> context(GameplayContext c, String locale) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("region", c.regionCode());
        result.put("requestedLocale", locale);
        result.put("ruleset", Map.of("id", c.rulesetId(), "code", c.rulesetCode()));
        result.put("patch", Map.of("id", c.patchId(), "code", c.patchCode()));
        result.put("patchVariantId", c.patchVariantId());
        result.put("effectiveAt", c.effectiveAt());
        return result;
    }
}
