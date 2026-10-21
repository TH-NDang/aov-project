package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.HeroImportRequest.Policy;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroImages;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.IdentifierAliases;
import java.util.*;
import tools.jackson.databind.json.JsonMapper;

/** Maps import fields to hero content while retaining existing translations, sources and artwork. */
final class HeroImportContent {
    private final HeroValidation validation;
    private final JsonMapper json;
    private final IdentifierAliases aliases;

    HeroImportContent(HeroValidation validation, JsonMapper json, IdentifierAliases aliases) {
        this.validation = validation;
        this.json = json;
        this.aliases = aliases;
    }

    Map<String, Object> existingFields(Map<HeroSection, Object> sections, String locale) {
        Profile profile = (Profile) sections.get(HeroSection.PROFILE);
        var translation = profile == null
                ? null
                : profile.translations().stream()
                        .filter(t -> t.locale().equals(locale)).findFirst().orElse(null);
        Map<String, Object> before = new LinkedHashMap<>();
        before.put("name", translation == null ? null : translation.name());
        before.put("title", translation == null ? null : translation.title());
        before.put("summary", translation == null ? null : translation.summary());
        before.put("lore", translation == null ? null : translation.lore());
        before.put("roles", profile == null ? Set.of() : profile.roles());
        var ratings = (Ratings) sections.get(HeroSection.OVERVIEW_RATINGS);
        before.put("overviewRatings", ratings == null || ratings.scaleCode() == null ? null : ratings);
        var stats = (Stats) sections.get(HeroSection.COMBAT_STATS);
        before.put("combatStats", stats == null || stats.values().isEmpty() ? null : stats);
        var skills = (Skills) sections.get(HeroSection.SKILLS);
        var skins = (Skins) sections.get(HeroSection.SKINS);
        before.put("skills", skills == null ? List.of() : skills.skills());
        before.put("skins", skins == null ? List.of() : skins.skins());
        var bindings = (Bindings) sections.get(HeroSection.MEDIA_BINDINGS);
        before.put("images", bindings == null ? Map.of() : bindings.images());
        for (var role : MediaRole.values()) {
            var asset = bindings == null ? null : bindings.bindings().get(role);
            before.put(role.name().toLowerCase(Locale.ROOT), asset == null ? null : asset.toString());
        }
        return before;
    }

    Map<String, Object> mergeAndNormalize(HeroImportRequest input, UUID heroId,
            Map<HeroSection, Object> sections, Map<String, Object> before) {
        var after = applyFieldPolicies(input, before);
        // Normalize collections before comparison so a repeated import remains a no-op.
        after.put("roles", json.convertValue(after.get("roles"), Role[].class));
        after.put("skills", json.convertValue(after.get("skills"), Skill[].class));
        normalizeSkinsAndRetainArtwork(heroId, (Skins) sections.get(HeroSection.SKINS), after);
        retainHeroArtwork((Bindings) sections.get(HeroSection.MEDIA_BINDINGS), after);
        normalizeStatistics(after);
        return after;
    }

    private Map<String, Object> applyFieldPolicies(HeroImportRequest input, Map<String, Object> before) {
        Map<String, Object> after = new LinkedHashMap<>(before);
        input.values().forEach((key, value) -> {
            var policy = input.policies().getOrDefault(key, Policy.FILL_EMPTY);
            if (policy != Policy.SKIP && !empty(value) && (policy == Policy.OVERWRITE || empty(before.get(key))))
                after.put(key, value);
        });
        return after;
    }

    private void normalizeSkinsAndRetainArtwork(UUID heroId, Skins existing, Map<String, Object> after) {
        var imported = new Skins(Arrays.asList(json.convertValue(after.get("skins"), Skin[].class)), List.of());
        validation.validate(HeroSection.SKINS, imported);
        after.put("skins", aliases.skins(heroId, imported).skins().toArray(Skin[]::new));
        if (existing == null)
            return;
        var incoming = new Skins(Arrays.asList((Skin[]) after.get("skins")), List.of());
        validation.validate(HeroSection.SKINS, incoming);
        var retained = (Skins) HeroImages.retain(existing, incoming);
        after.put("skins", retained.skins().toArray(Skin[]::new));
    }

    private void retainHeroArtwork(Bindings existing, Map<String, Object> after) {
        if (existing == null)
            return;
        Map<MediaRole, UUID> mains = new EnumMap<>(MediaRole.class);
        for (var role : MediaRole.values()) {
            var asset = after.get(role.name().toLowerCase(Locale.ROOT));
            if (asset != null)
                mains.put(role, UUID.fromString(asset.toString()));
        }
        var incoming = new Bindings(mains, List.of(), imageOptions(after.get("images")));
        validation.validate(HeroSection.MEDIA_BINDINGS, incoming);
        var retained = (Bindings) HeroImages.retain(existing, incoming);
        after.put("images", retained.images());
    }

    private void normalizeStatistics(Map<String, Object> after) {
        if (!empty(after.get("overviewRatings")))
            after.put("overviewRatings", json.convertValue(after.get("overviewRatings"), Ratings.class));
        if (empty(after.get("combatStats")))
            return;
        var imported = json.convertValue(after.get("combatStats"), Stats.class);
        validation.validate(HeroSection.COMBAT_STATS, imported);
        after.put("combatStats", new Stats(imported.values().stream()
                .sorted(Comparator.comparing(Stat::statKey)).toList(), imported.sources()));
    }

    @SuppressWarnings("unchecked")
    Map<String, Object> serializedFields(Map<String, Object> fields) {
        return json.convertValue(fields, Map.class);
    }

    void validate(String locale, Map<String, Object> values, Profile existing) {
        validation.validate(HeroSection.PROFILE, profile(locale, values, existing));
        if (values.get("overviewRatings") != null)
            validation.validate(HeroSection.OVERVIEW_RATINGS,
                    json.convertValue(values.get("overviewRatings"), Ratings.class));
        if (values.get("combatStats") != null)
            validation.validate(HeroSection.COMBAT_STATS, json.convertValue(values.get("combatStats"), Stats.class));
        Map<MediaRole, UUID> bindings = new EnumMap<>(MediaRole.class);
        for (var role : MediaRole.values()) {
            Object id = values.get(role.name().toLowerCase(Locale.ROOT));
            if (id != null)
                bindings.put(role, UUID.fromString((String) id));
        }
        validation.validate(HeroSection.MEDIA_BINDINGS,
                new Bindings(bindings, List.of(), imageOptions(values.get("images"))));
        var skills = Arrays.asList(json.convertValue(values.get("skills"), Skill[].class));
        if (!skills.isEmpty())
            validation.validate(HeroSection.SKILLS, new Skills(skills, List.of()));
        validation.validate(HeroSection.SKINS,
                new Skins(Arrays.asList(json.convertValue(values.get("skins"), Skin[].class)), List.of()));
    }

    Map<MediaRole, List<ImageOption>> imageOptions(Object value) {
        var converted = json.convertValue(
                Map.of("bindings", Map.of(), "sources", List.of(), "images", value == null ? Map.of() : value),
                Bindings.class);
        return converted.images();
    }

    Profile profile(String locale, Map<String, Object> values, Profile old) {
        var translations = new ArrayList<ProfileTranslation>();
        if (old != null)
            old.translations().stream().filter(t -> !t.locale().equals(locale)).forEach(translations::add);
        translations.add(new ProfileTranslation(locale, (String) values.get("name"), (String) values.get("title"),
                (String) values.get("summary"), (String) values.get("lore")));
        return new Profile(translations,
                new LinkedHashSet<>(Arrays.asList(json.convertValue(values.get("roles"), Role[].class))),
                old == null ? List.of() : old.sources());
    }

    static boolean empty(Object value) {
        return value == null || value instanceof String s && s.isBlank()
                || value instanceof Collection<?> c && c.isEmpty() || value instanceof Map<?, ?> m && m.isEmpty();
    }
}
