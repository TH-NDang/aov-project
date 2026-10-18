package com.wikiaov.hero.internal.application.service;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.persistence.*;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.*;
import com.wikiaov.platform.*;
import java.time.*;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

@Service
@Transactional(readOnly = true)
public class HeroQueries {
    private final HeroStore store;
    private final HeroSections sections;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final JsonMapper json;
    private final Clock clock;
    public HeroQueries(HeroStore store, HeroSections sections, GameplayContexts contexts, MediaAssets media,
            JsonMapper json, Clock clock) {
        this.store = store;
        this.sections = sections;
        this.contexts = contexts;
        this.media = media;
        this.json = json;
        this.clock = clock;
    }

    public Optional<HeroRevisionView> current(UUID heroId, GameplayContext context, Instant at) {
        Map<UUID, Long> ordinals = new HashMap<>();
        return store.revisions(heroId).stream()
                .filter(r -> r.state().equals("PUBLISHED") && r.rulesetId().equals(context.rulesetId())
                        && !r.publishedAt().isAfter(at))
                .filter(r -> ordinal(r, ordinals) <= context.rulesetOrdinal())
                .max(Comparator.<HeroRevisionView>comparingLong(r -> ordinal(r, ordinals))
                        .thenComparingLong(HeroRevisionView::publicationSequence));
    }

    private long ordinal(HeroRevisionView rev, Map<UUID, Long> cache) {
        return rev.effectiveFromPatchVariantId() == null
                ? 0
                : cache.computeIfAbsent(rev.effectiveFromPatchVariantId(), id -> contexts.variant(id).rulesetOrdinal());
    }

    public Map<String, Object> detail(UUID heroId, String region, String locale, boolean manifest) {
        HeroValidation.locale(locale);
        Instant at = clock.instant();
        var context = contexts.resolve(region, at);
        var rev = current(heroId, context, at).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                "No published hero is available in this context."));
        return detail(rev, context, locale, manifest);
    }

    private Map<String, Object> detail(HeroRevisionView rev, GameplayContext ctx, String locale, boolean manifest) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("context", context(ctx, locale));
        result.put("id", rev.heroId());
        result.put("revisionId", rev.id());
        result.put("code", store.rows("SELECT code FROM hero.hero WHERE id=?", rev.heroId()).getFirst().get("code"));
        Map<String, Object> refs = new LinkedHashMap<>();
        rev.sections().forEach((s, id) -> refs.put(sectionKey(s), id));
        result.put("sections", refs);
        if (!manifest) {
            Map<String, Object> content = new LinkedHashMap<>();
            rev.sections().forEach((s, id) -> content.put(sectionKey(s), publicContent(s, id, locale)));
            result.put("content", content);
            var bindings = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                    rev.sections().get(HeroSection.MEDIA_BINDINGS));
            Map<String, Object> assets = new LinkedHashMap<>();
            bindings.bindings().forEach(
                    (role, id) -> media.find(id).filter(a -> a.usable()).ifPresent(a -> assets.put(role.name(), a)));
            result.put("media", assets);
            Map<String, Object> skillMedia = new LinkedHashMap<>();
            var skills = (Skills) sections.content(HeroSection.SKILLS, rev.sections().get(HeroSection.SKILLS));
            skills.skills().forEach(skill -> {
                if (skill.iconAssetId() != null)
                    media.find(skill.iconAssetId()).filter(a -> a.usable())
                            .ifPresent(a -> skillMedia.put(skill.skillKey(), a));
            });
            result.put("skillMedia", skillMedia);
            Map<String, Object> skinMedia = new LinkedHashMap<>();
            Map<String, Object> skinHeadMedia = new LinkedHashMap<>();
            Map<String, Object> skinPortraitMedia = new LinkedHashMap<>();
            var skins = (Skins) sections.content(HeroSection.SKINS, rev.sections().get(HeroSection.SKINS));
            skins.skins().forEach(skin -> {
                if (skin.artAssetId() != null)
                    media.find(skin.artAssetId()).filter(a -> a.usable())
                            .ifPresent(a -> skinMedia.put(skin.skinKey(), a));
                if (skin.headAssetId() != null)
                    media.find(skin.headAssetId()).filter(a -> a.usable())
                            .ifPresent(a -> skinHeadMedia.put(skin.skinKey(), a));
                if (skin.portraitAssetId() != null)
                    media.find(skin.portraitAssetId()).filter(a -> a.usable())
                            .ifPresent(a -> skinPortraitMedia.put(skin.skinKey(), a));
            });
            result.put("skinMedia", skinMedia);
            result.put("skinHeadMedia", skinHeadMedia);
            result.put("skinPortraitMedia", skinPortraitMedia);
        }
        var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
        String actual = translationLocale(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                locale);
        ((Map<String, Object>) result.get("context")).put("actualLocale", actual);
        ((Map<String, Object>) result.get("context")).put("fallbackApplied", !locale.equals(actual));
        return result;
    }

    public Map<String, Object> list(String region, String locale, int page, int size, String q, String role,
            String sort) {
        HeroValidation.locale(locale);
        if (page < 0 || size < 1 || size > 100)
            throw HeroValidation.invalid("Page must be nonnegative and size between 1 and 100.");
        if (!Set.of("code,asc", "code,desc").contains(sort))
            throw HeroValidation.invalid("Only code sorting is supported.");
        if (q.length() > 120)
            throw HeroValidation.invalid("Search text is too long.");
        if (role != null)
            try {
                Role.valueOf(role);
            } catch (IllegalArgumentException e) {
                throw HeroValidation.invalid("Unknown hero role.");
            }
        Instant at = clock.instant();
        var ctx = contexts.resolve(region, at);
        List<Map<String, Object>> all = new ArrayList<>();
        for (var row : store
                .rows("SELECT id,code FROM hero.hero ORDER BY code " + (sort.endsWith("desc") ? "DESC" : "ASC"))) {
            var selected = current((UUID) row.get("id"), ctx, at);
            if (selected.isEmpty())
                continue;
            var rev = selected.get();
            var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
            if (role != null && profile.roles().stream().noneMatch(r -> r.name().equals(role)))
                continue;
            String actual = translationLocale(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                    locale);
            var translated = profile.translations().stream().filter(t -> t.locale().equals(actual)).findFirst()
                    .orElseThrow();
            if (!q.isBlank() && !((String) row.get("code")).contains(q.toLowerCase(Locale.ROOT))
                    && !translated.name().toLowerCase(Locale.ROOT).contains(q.toLowerCase(Locale.ROOT)))
                continue;
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", rev.heroId());
            item.put("code", row.get("code"));
            item.put("revisionId", rev.id());
            item.put("name", translated.name());
            item.put("actualLocale", actual);
            item.put("roles", profile.roles());
            var bindings = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                    rev.sections().get(HeroSection.MEDIA_BINDINGS));
            UUID head = bindings.bindings().get(MediaRole.HEAD);
            if (head != null)
                media.find(head).filter(a -> a.usable()).ifPresent(a -> item.put("head", a));
            all.add(item);
        }
        long offset = (long) page * size;
        var items = offset >= all.size()
                ? List.<Map<String, Object>>of()
                : all.subList((int) offset, (int) Math.min(offset + size, all.size()));
        return Map.of("context", context(ctx, locale), "items", items, "page", page, "size", size, "totalElements",
                all.size(), "totalPages", all.isEmpty() ? 0 : (all.size() + size - 1) / size);
    }

    public Map<String, Object> section(HeroSection section, UUID id, String locale) {
        HeroValidation.locale(locale);
        if (store.rows(
                "SELECT id FROM hero.hero_revision WHERE state='PUBLISHED' AND " + section.column() + "=? LIMIT 1", id)
                .isEmpty())
            throw new ApiException(HeroErrorCode.HERO_REVISION_NOT_FOUND, "No published section exists with this ID.");
        return Map.of("id", id, "content", publicContent(section, id, locale));
    }

    private Map<String, Object> publicContent(HeroSection section, UUID id, String locale) {
        Map<String, Object> content = new LinkedHashMap<>(json.convertValue(sections.content(section, id), Map.class));
        content.remove("sources");
        if (section == HeroSection.PROFILE)
            localize(content, locale);
        if (section == HeroSection.SKILLS || section == HeroSection.SKINS) {
            String key = section == HeroSection.SKILLS ? "skills" : "skins";
            for (var item : (List<Map<String, Object>>) content.get(key))
                localize(item, locale);
        }
        return content;
    }

    private void localize(Map<String, Object> object, String locale) {
        var translations = (List<Map<String, Object>>) object.remove("translations");
        String actual = translationLocale(translations.stream().map(t -> (String) t.get("locale")).toList(), locale);
        var selected = translations.stream().filter(t -> t.get("locale").equals(actual)).findFirst().orElseThrow();
        object.putAll(selected);
        object.remove("locale");
        object.put("actualLocale", actual);
        object.put("fallbackApplied", !locale.equals(actual));
    }

    private static String translationLocale(List<String> values, String requested) {
        return values.contains(requested)
                ? requested
                : values.contains("vi-VN")
                        ? "vi-VN"
                        : values.stream().sorted().findFirst()
                                .orElseThrow(() -> HeroValidation.invalid("A published section has no translation."));
    }

    public static String sectionKey(HeroSection s) {
        return switch (s) {
            case PROFILE -> "profile";
            case OVERVIEW_RATINGS -> "overviewRatings";
            case COMBAT_STATS -> "combatStats";
            case SKILLS -> "skills";
            case SKINS -> "skins";
            case MEDIA_BINDINGS -> "mediaBindings";
        };
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
