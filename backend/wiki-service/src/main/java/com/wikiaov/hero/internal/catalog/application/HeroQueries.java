package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.hero.internal.skills.application.SkillLibraryIcons;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.*;
import com.wikiaov.platform.*;
import java.time.*;
import java.util.*;
import java.util.stream.Collectors;
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
    private final HeroForms forms;
    private final SkillLibraryIcons libraryIcons;
    private final HeroReadMoments moments;

    public HeroQueries(HeroStore store, HeroSections sections, GameplayContexts contexts, MediaAssets media,
            JsonMapper json, Clock clock, HeroForms forms, SkillLibraryIcons libraryIcons, HeroReadMoments moments) {
        this.store = store;
        this.sections = sections;
        this.contexts = contexts;
        this.media = media;
        this.json = json;
        this.clock = clock;
        this.forms = forms;
        this.libraryIcons = libraryIcons;
        this.moments = moments;
    }

    public Optional<HeroRevisionView> current(UUID heroId, GameplayContext context, Instant at) {
        return current(heroId, context, at, true);
    }

    public Optional<HeroRevisionView> current(UUID heroId, GameplayContext context, Instant at, boolean allowUnscoped) {
        return select(store.revisions(heroId), context, at, allowUnscoped, new HashMap<>());
    }

    /** The revisions readers see at {@code at}, in any active context, for many heroes with one read of each. */
    public Set<UUID> currentRevisionIds(Collection<UUID> heroIds, Instant at) {
        var byHero = store.revisions(heroIds).stream().collect(Collectors.groupingBy(HeroRevisionView::heroId));
        Map<UUID, Long> ordinals = new HashMap<>();
        Set<UUID> current = new HashSet<>();

        for (var context : contexts.active(at))
            for (var revisions : byHero.values())
                select(revisions, context, at, true, ordinals).ifPresent(revision -> current.add(revision.id()));

        return current;
    }

    private Optional<HeroRevisionView> select(List<HeroRevisionView> revisions, GameplayContext context, Instant at,
            boolean allowUnscoped, Map<UUID, Long> ordinals) {
        return revisions.stream()
                .filter(r -> r.state().equals("PUBLISHED") && r.rulesetId().equals(context.rulesetId())
                        && !r.publishedAt().isAfter(at))
                .filter(r -> allowUnscoped || r.effectiveFromPatchVariantId() != null)
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
        return detail(heroId, region, locale, manifest, null, null, false);
    }

    public Map<String, Object> detail(UUID heroId, String region, String locale, boolean manifest,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        HeroValidation.locale(locale);

        Instant at = clock.instant();
        var moment = moments.resolve(region, at, seasonId, patchVariantId, includeUnscoped);
        var context = moment.context();
        var choice = choose(heroId, moment, at).orElseThrow(() -> new ApiException(HeroErrorCode.HERO_NOT_FOUND,
                "No published hero is available in this context."));

        var result = detail(choice.revision(), context, locale, manifest);
        markLaterObservation(result, choice);
        addForms(result, heroId, moment, at, locale, manifest);
        return result;
    }

    /** The published revision readers see of one hero at the selected moment (ADR-016). */
    private Optional<HeroReadMoments.Choice<HeroRevisionView>> choose(UUID heroId, HeroReadMoments.Moment moment,
            Instant at) {
        var revisions = store.revisions(heroId).stream()
                .filter(r -> r.state().equals("PUBLISHED") && r.rulesetId().equals(moment.context().rulesetId())
                        && !r.publishedAt().isAfter(at))
                .toList();

        return moment.choose(heroId, revisions, HeroRevisionView::effectiveFromPatchVariantId,
                HeroRevisionView::publicationSequence);
    }

    /** Content observed at a later patch says so, and readers are never shown it as the selected patch's data. */
    private void markLaterObservation(Map<String, Object> entry, HeroReadMoments.Choice<?> choice) {
        if (choice.laterVariantId() != null)
            entry.put("laterObservation", Map.of("patchVariantId", choice.laterVariantId(), "patchCode",
                    contexts.patchCode(choice.laterVariantId())));
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
            for (var form : structure.formsOf(heroId))
                choose(form.heroId(), moment, at).ifPresent(formChoice -> {
                    var entry = detail(formChoice.revision(), moment.context(), locale, manifest);
                    markLaterObservation(entry, formChoice);
                    var formContext = (Map<String, Object>) entry.remove("context");
                    entry.put("formKey", form.formKey());
                    entry.put("displayOrder", form.displayOrder());
                    entry.put("actualLocale", formContext.get("actualLocale"));
                    entry.put("fallbackApplied", formContext.get("fallbackApplied"));
                    entries.add(entry);
                });
            result.put("forms", entries);
        }
        structure.form(heroId).ifPresent(form -> result.put("parent", parent(form, store.hero(form.holderId()))));
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
        result.put("code", store.hero(rev.heroId()).getCode());
        result.put("unscopedBaseline", rev.effectiveFromPatchVariantId() == null);

        Map<String, Object> refs = new LinkedHashMap<>();
        rev.sections().forEach((s, id) -> refs.put(sectionKey(s), id));
        result.put("sections", refs);

        if (!manifest) {
            Map<String, Object> content = new LinkedHashMap<>();
            rev.sections().forEach((s, id) -> content.put(sectionKey(s), publicContent(s, id, locale)));
            result.put("content", content);

            addHeroMedia(result, rev);
            addSkillMedia(result, rev);
            addSkinMedia(result, rev);
        }

        var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
        String actual = translationLocale(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                locale);
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
            if (iconId != null)
                media.find(iconId).filter(a -> a.usable()).ifPresent(a -> skillMedia.put(skill.skillKey(), a));
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

    public Map<String, Object> list(String region, String locale, int page, int size, String q, String role,
            String sort) {
        return list(region, locale, page, size, q, role, sort, null, null, false);
    }

    public Map<String, Object> list(String region, String locale, int page, int size, String q, String role,
            String sort, UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        return list(region, locale, page, size, q, role, sort, seasonId, patchVariantId, includeUnscoped, false);
    }

    /**
     * Lists what readers browse (ADR-024): heroes without forms and heroes that hold forms, each holder carrying its
     * published forms. With {@code playable}, lists what players pick instead: heroes without forms and every form,
     * each form naming its holder; heroes that hold forms are left out.
     */
    public Map<String, Object> list(String region, String locale, int page, int size, String q, String role,
            String sort, UUID seasonId, UUID patchVariantId, boolean includeUnscoped, boolean playable) {
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
        var moment = moments.resolve(region, at, seasonId, patchVariantId, includeUnscoped);
        var ctx = moment.context();
        var structure = forms.structure();
        var heroes = store.heroes(sort.endsWith("desc"));
        var codes = heroes.stream().collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode));

        Map<UUID, Published> published = new LinkedHashMap<>();
        for (var hero : heroes)
            choose(hero.getId(), moment, at).ifPresent(
                    choice -> published.put(hero.getId(), published(hero, choice, locale)));

        List<ListEntry> all = new ArrayList<>();
        for (var hero : published.values()) {
            UUID id = hero.identity().getId();
            boolean holder = structure.holdsForms(id);
            if (playable ? holder : structure.isForm(id))
                continue;

            var members = holder
                    ? structure.formsOf(id).stream().map(form -> published.get(form.heroId())).filter(Objects::nonNull)
                            .toList()
                    : List.<Published>of();
            if (holder && members.isEmpty())
                continue;
            var roles = holder ? union(members, Published::roles) : hero.roles();
            var positions = holder ? union(members, Published::positions) : hero.positions();
            if (role != null && roles.stream().noneMatch(r -> r.name().equals(role)))
                continue;
            if (!q.isBlank() && !hero.matches(q) && members.stream().noneMatch(member -> member.matches(q)))
                continue;

            var item = hero.item();
            item.put("roles", roles);
            item.put("positions", positions.stream().sorted().toList());
            List<ListEntry> formEntries = new ArrayList<>();
            for (var member : members) {
                var form = structure.form(member.identity().getId()).orElseThrow();
                var formItem = member.item();
                formItem.put("formKey", form.formKey());
                formItem.put("roles", member.roles());
                formItem.put("positions", member.positions().stream().sorted().toList());
                formEntries.add(new ListEntry(formItem, member.bindingsId(), List.of()));
            }
            if (holder)
                item.put("forms", formEntries.stream().map(ListEntry::item).toList());
            if (playable)
                structure.form(id).ifPresent(form -> item.put("parent",
                        Map.of("id", form.holderId(), "code", codes.get(form.holderId()), "formKey", form.formKey())));

            all.add(new ListEntry(item, hero.bindingsId(), formEntries));
        }

        long offset = (long) page * size;
        var selected = offset >= all.size()
                ? List.<ListEntry>of()
                : all.subList((int) offset, (int) Math.min(offset + size, all.size()));
        var items = listMedia(selected);

        return Map.of("context", context(ctx, locale), "items", items, "page", page, "size", size, "totalElements",
                all.size(), "totalPages", all.isEmpty() ? 0 : (all.size() + size - 1) / size);
    }

    private Published published(HeroIdentity hero, HeroReadMoments.Choice<HeroRevisionView> choice, String locale) {
        var rev = choice.revision();
        var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
        String actual = translationLocale(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                locale);
        var translated = profile.translations().stream().filter(t -> t.locale().equals(actual)).findFirst()
                .orElseThrow();
        var later = choice.laterVariantId() == null
                ? null
                : Map.<String, Object>of("patchVariantId", choice.laterVariantId(), "patchCode",
                        contexts.patchCode(choice.laterVariantId()));
        return new Published(hero, rev, translated.name(), actual, profile.roles(), profile.positions(),
                rev.sections().get(HeroSection.MEDIA_BINDINGS), later);
    }

    private static <T> Set<T> union(List<Published> heroes, java.util.function.Function<Published, Set<T>> values) {
        Set<T> result = new LinkedHashSet<>();
        heroes.forEach(hero -> result.addAll(values.apply(hero)));
        return result;
    }

    /** Reads the head and portrait of every hero and form on the page in one batch. */
    private List<Map<String, Object>> listMedia(List<ListEntry> entries) {
        if (entries.isEmpty())
            return List.of();

        var everyEntry = entries.stream().flatMap(entry -> java.util.stream.Stream.concat(
                java.util.stream.Stream.of(entry), entry.forms().stream())).toList();
        Map<UUID, Bindings> bindings = new HashMap<>();
        Set<UUID> assetIds = new HashSet<>();
        for (var entry : everyEntry) {
            var value = bindings.computeIfAbsent(entry.mediaBindingRevisionId(),
                    id -> (Bindings) sections.content(HeroSection.MEDIA_BINDINGS, id));
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = value.bindings().get(role);
                if (assetId != null)
                    assetIds.add(assetId);
            }
        }

        var assets = media.findAll(assetIds);
        for (var entry : everyEntry) {
            var selected = bindings.get(entry.mediaBindingRevisionId()).bindings();
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = selected.get(role);
                var asset = assetId == null ? null : assets.get(assetId);
                if (asset != null && asset.usable())
                    entry.item().put(role.name().toLowerCase(Locale.ROOT), asset);
            }
        }
        return entries.stream().map(ListEntry::item).toList();
    }

    private record Published(
            HeroIdentity identity,
            HeroRevisionView revision,
            String name,
            String actualLocale,
            Set<Role> roles,
            Set<Position> positions,
            UUID bindingsId,
            Map<String, Object> laterObservation
    ) {
        boolean matches(String q) {
            String query = q.toLowerCase(Locale.ROOT);
            return identity.getCode().contains(query) || name.toLowerCase(Locale.ROOT).contains(query);
        }

        Map<String, Object> item() {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", identity.getId());
            item.put("code", identity.getCode());
            item.put("revisionId", revision.id());
            item.put("unscopedBaseline", revision.effectiveFromPatchVariantId() == null);
            item.put("name", name);
            item.put("actualLocale", actualLocale);
            if (laterObservation != null)
                item.put("laterObservation", laterObservation);
            return item;
        }
    }

    private record ListEntry(
            Map<String, Object> item,
            UUID mediaBindingRevisionId,
            List<ListEntry> forms
    ) {
    }

    public Map<String, Object> section(HeroSection section, UUID id, String locale) {
        HeroValidation.locale(locale);
        if (!store.publishedSectionExists(section, id))
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
