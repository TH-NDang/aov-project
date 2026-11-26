package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroListView;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.ProfileTranslation;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroContent.Skills;
import com.wikiaov.hero.internal.domain.HeroContent.Skins;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.ratings.persistence.HeroRatingSnapshots;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.hero.internal.skills.application.SkillLibraryIcons;
import com.wikiaov.media.MediaAssetReference;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.RevisionState;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroQueries {
    private final HeroStore store;
    private final HeroSections sections;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final Clock clock;
    private final HeroForms forms;
    private final SkillLibraryIcons libraryIcons;
    private final HeroReadMoments moments;
    private final HeroRatingSnapshots ratings;

    public HeroQueries(HeroStore store, HeroSections sections, GameplayContexts contexts, MediaAssets media,
            Clock clock, HeroForms forms, SkillLibraryIcons libraryIcons, HeroReadMoments moments,
            HeroRatingSnapshots ratings) {
        this.store = store;
        this.sections = sections;
        this.contexts = contexts;
        this.media = media;
        this.clock = clock;
        this.forms = forms;
        this.libraryIcons = libraryIcons;
        this.moments = moments;
        this.ratings = ratings;
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

        for (var context : contexts.active(at)) {
            for (var revisions : byHero.values()) {
                select(revisions, context, at, true, ordinals).ifPresent(revision -> current.add(revision.id()));
            }
        }

        return current;
    }

    private Optional<HeroRevisionView> select(List<HeroRevisionView> revisions, GameplayContext context, Instant at,
            boolean allowUnscoped, Map<UUID, Long> ordinals) {
        return revisions.stream()
                .filter(r -> r.state() == RevisionState.PUBLISHED && r.rulesetId().equals(context.rulesetId())
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
        return choose(heroId, store.revisions(heroId), moment, at);
    }

    private static Optional<HeroReadMoments.Choice<HeroRevisionView>> choose(UUID heroId,
            List<HeroRevisionView> all, HeroReadMoments.Moment moment, Instant at) {
        var revisions = all.stream()
                .filter(r -> r.state() == RevisionState.PUBLISHED && r.rulesetId().equals(moment.context().rulesetId())
                        && !r.publishedAt().isAfter(at))
                .toList();

        return moment.choose(heroId, revisions, HeroRevisionView::effectiveFromPatchVariantId,
                HeroRevisionView::publicationSequence);
    }

    /** Content observed at a later patch says so, and readers are never shown it as the selected patch's data. */
    private void markLaterObservation(Map<String, Object> entry, HeroReadMoments.Choice<?> choice) {
        if (choice.laterVariantId() != null) {
            entry.put("laterObservation", Map.of("patchVariantId", choice.laterVariantId(), "patchCode",
                    contexts.patchCode(choice.laterVariantId())));
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

    /**
     * Lists what readers browse (ADR-024): heroes without forms and heroes that hold forms, each holder carrying its
     * published forms. With {@code playable}, lists what players pick instead: heroes without forms and every form,
     * each form naming its holder; heroes that hold forms are left out.
     */
    public HeroListView list(String region, String locale, int page, int size, String q, String role,
            String sort, UUID seasonId, UUID patchVariantId, boolean includeUnscoped, boolean playable) {
        validateListQuery(locale, sort, q, role);

        Instant at = clock.instant();
        var moment = moments.resolve(region, at, seasonId, patchVariantId, includeUnscoped);
        var ctx = moment.context();
        var structure = forms.structure();
        var heroes = store.heroes(sort.endsWith("desc"));
        var codes = heroes.stream().collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode));

        // Every revision and every chosen profile in a bounded number of queries: the list covers all heroes, whatever
        // page is asked for.
        var revisions = store.revisions(heroes.stream().map(HeroIdentity::getId).toList()).stream()
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));
        Map<UUID, HeroReadMoments.Choice<HeroRevisionView>> choices = new LinkedHashMap<>();
        for (var hero : heroes) {
            choose(hero.getId(), revisions.getOrDefault(hero.getId(), List.of()), moment, at)
                    .ifPresent(choice -> choices.put(hero.getId(), choice));
        }
        var profiles = sections.contents(HeroSection.PROFILE, choices.values().stream()
                .map(choice -> choice.revision().sections().get(HeroSection.PROFILE)).filter(Objects::nonNull)
                .toList());

        Map<UUID, Published> published = new LinkedHashMap<>();
        for (var hero : heroes) {
            var choice = choices.get(hero.getId());
            if (choice != null) {
                var profile = (Profile) profiles.get(choice.revision().sections().get(HeroSection.PROFILE));
                published.put(hero.getId(), published(hero, choice, profile, locale));
            }
        }

        List<ListEntry> all = new ArrayList<>();
        for (var hero : published.values()) {
            UUID id = hero.identity().getId();
            boolean holder = structure.holdsForms(id);
            if (playable ? holder : structure.isForm(id)) {
                continue;
            }

            var members = holder
                    ? structure.formsOf(id).stream().map(form -> published.get(form.heroId())).filter(Objects::nonNull)
                            .toList()
                    : List.<Published>of();
            if (holder && members.isEmpty()) {
                continue;
            }
            var roles = holder ? union(members, Published::roles) : hero.roles();
            var positions = holder ? union(members, Published::positions) : hero.positions();
            if (role != null && roles.stream().noneMatch(r -> r.name().equals(role))) {
                continue;
            }
            if (!q.isBlank() && !hero.matches(q) && members.stream().noneMatch(member -> member.matches(q))) {
                continue;
            }

            all.add(listEntry(hero, members, roles, positions, holder, playable, structure, codes));
        }

        // Paged in memory: each hero shows the revision the read moment chooses and carries its forms, so the page is
        // cut after both; the list is bounded by the heroes of the game.
        var selected = PageSlice.of(all, page, size);
        listDifficulties(selected.items());
        var items = listMedia(selected.items());

        return new HeroListView(listContext(ctx, locale), selected.withItems(items));
    }

    private static void validateListQuery(String locale, String sort, String q, String role) {
        HeroValidation.locale(locale);
        if (!Set.of("code,asc", "code,desc").contains(sort)) {
            throw HeroValidation.badQuery("Only code sorting is supported.");
        }
        if (q.length() > 120) {
            throw HeroValidation.badQuery("Search text is too long.");
        }
        if (role != null) {
            try {
                Role.valueOf(role);
            } catch (IllegalArgumentException e) {
                throw HeroValidation.badQuery("Unknown hero role.");
            }
        }
    }

    /** One listed hero, as a holder with its forms, or as a playable form naming the hero that holds it. */
    private static ListEntry listEntry(Published hero, List<Published> members, Set<Role> roles,
            Set<Position> positions, boolean holder, boolean playable, HeroFormStructure structure,
            Map<UUID, String> codes) {
        UUID id = hero.identity().getId();
        var item = hero.item();
        item.put("roles", roles);
        item.put("positions", positions.stream().sorted().toList());
        List<ListEntry> formEntries = new ArrayList<>();
        for (var member : members) {
            var form = structure.form(member.identity().getId())
                    .orElseThrow(() -> new IllegalStateException("A listed form has no form structure."));
            var formItem = member.item();
            formItem.put("formKey", form.formKey());
            formItem.put("roles", member.roles());
            formItem.put("positions", member.positions().stream().sorted().toList());
            formEntries.add(new ListEntry(formItem, member.bindingsId(), member.ratingsId(), List.of()));
        }
        if (holder) {
            item.put("forms", formEntries.stream().map(ListEntry::item).toList());
        }
        if (playable) {
            structure.form(id).ifPresent(form -> item.put("parent",
                    Map.of("id", form.holderId(), "code", codes.get(form.holderId()), "formKey", form.formKey())));
        }

        return new ListEntry(item, hero.bindingsId(), hero.ratingsId(), formEntries);
    }

    private static HeroListView.Context listContext(GameplayContext c, String locale) {
        return new HeroListView.Context(c.regionCode(), locale,
                new HeroListView.Reference(c.rulesetId(), c.rulesetCode()),
                new HeroListView.Reference(c.patchId(), c.patchCode()), c.patchVariantId(), c.effectiveAt());
    }

    private Published published(HeroIdentity hero, HeroReadMoments.Choice<HeroRevisionView> choice, Profile profile,
            String locale) {
        var rev = choice.revision();
        String actual = translationLocale(profile.translations().stream().map(ProfileTranslation::locale).toList(),
                locale);
        var translated = profile.translations().stream().filter(t -> t.locale().equals(actual)).findFirst()
                .orElseThrow(() -> new IllegalStateException("The selected profile locale has no translation."));
        var later = choice.laterVariantId() == null
                ? null
                : Map.<String, Object>of("patchVariantId", choice.laterVariantId(), "patchCode",
                        contexts.patchCode(choice.laterVariantId()));
        return new Published(hero, rev, translated.name(), actual, profile.roles(), profile.positions(),
                rev.sections().get(HeroSection.MEDIA_BINDINGS), later);
    }

    private static <T> Set<T> union(List<Published> heroes, Function<Published, Set<T>> values) {
        Set<T> result = new LinkedHashSet<>();
        heroes.forEach(hero -> result.addAll(values.apply(hero)));
        return result;
    }

    /**
     * Gives every hero and form on the page the difficulty of its overview ratings, the value the detail shows under
     * {@code content.overviewRatings.difficulty}, read in one batch; null when the revision has no ratings.
     */
    private void listDifficulties(List<ListEntry> entries) {
        var everyEntry = entries.stream().flatMap(entry -> Stream.concat(
                Stream.of(entry), entry.forms().stream())).toList();
        var ids = everyEntry.stream().map(ListEntry::ratingsRevisionId).filter(Objects::nonNull)
                .collect(Collectors.toSet());

        Map<UUID, BigDecimal> difficulties = ids.isEmpty() ? Map.of() : ratings.difficulties(ids);
        for (var entry : everyEntry) {
            var id = entry.ratingsRevisionId();
            entry.item().put("difficulty", id == null ? null : difficulties.get(id));
        }
    }

    /** Reads the head and portrait of every hero and form on the page in one batch. */
    private List<Map<String, Object>> listMedia(List<ListEntry> entries) {
        if (entries.isEmpty()) {
            return List.of();
        }

        var everyEntry = entries.stream().flatMap(entry -> Stream.concat(
                Stream.of(entry), entry.forms().stream())).toList();
        Map<UUID, Bindings> bindings = new HashMap<>();
        sections.contents(HeroSection.MEDIA_BINDINGS,
                everyEntry.stream().map(ListEntry::mediaBindingRevisionId).filter(Objects::nonNull).distinct().toList())
                .forEach((id, value) -> bindings.put(id, (Bindings) value));
        Set<UUID> assetIds = new HashSet<>();
        for (var entry : everyEntry) {
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = boundAsset(bindings, entry, role);
                if (assetId != null) {
                    assetIds.add(assetId);
                }
            }
        }

        var assets = media.findAll(assetIds);
        for (var entry : everyEntry) {
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = boundAsset(bindings, entry, role);
                var asset = assetId == null ? null : assets.get(assetId);
                if (asset != null && asset.usable()) {
                    entry.item().put(role.name().toLowerCase(Locale.ROOT), asset);
                }
            }
            // A listed hero is drawn by its portrait, which carries the credit; the head is only its small mark, so
            // its credits stay on the hero's own page and the list stays small (spec 03, section 4).
            if (entry.item().get("portrait") != null
                    && entry.item().get("head") instanceof MediaAssetReference head) {
                entry.item().put("head", head.withoutSources());
            }
        }
        return entries.stream().map(ListEntry::item).toList();
    }

    /** The asset an entry binds to a role, or null when the revision has no media bindings or none for the role. */
    private static @Nullable UUID boundAsset(Map<UUID, Bindings> bindings, ListEntry entry, MediaRole role) {
        var value = entry.mediaBindingRevisionId() == null ? null : bindings.get(entry.mediaBindingRevisionId());
        return value == null ? null : value.bindings().get(role);
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

        @Nullable
        UUID ratingsId() {
            return revision.sections().get(HeroSection.OVERVIEW_RATINGS);
        }

        Map<String, Object> item() {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", identity.getId());
            item.put("code", identity.getCode());
            item.put("revisionId", revision.id());
            item.put("unscopedBaseline", revision.effectiveFromPatchVariantId() == null);
            item.put("name", name);
            item.put("actualLocale", actualLocale);
            if (laterObservation != null) {
                item.put("laterObservation", laterObservation);
            }
            return item;
        }
    }

    private record ListEntry(
            Map<String, Object> item,
            UUID mediaBindingRevisionId,
            @Nullable UUID ratingsRevisionId,
            List<ListEntry> forms
    ) {
    }

    /** The published revision readers see today of every hero in a market, keyed by hero, in code order. */
    public Map<HeroIdentity, HeroRevisionView> published(String region) {
        Instant at = clock.instant();
        var moment = moments.resolve(region, at, null, null, false);

        var heroes = store.heroes(false);
        var revisions = store.revisions(heroes.stream().map(HeroIdentity::getId).toList()).stream()
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));

        Map<HeroIdentity, HeroRevisionView> result = new LinkedHashMap<>();
        for (var hero : heroes) {
            choose(hero.getId(), revisions.getOrDefault(hero.getId(), List.of()), moment, at)
                    .ifPresent(choice -> result.put(hero, choice.revision()));
        }
        return result;
    }

    private static String translationLocale(List<String> values, String requested) {
        String selected = CatalogLocales.pick(values, requested, Function.identity());
        if (selected == null) {
            throw HeroValidation.invalid("A published section has no translation.");
        }
        return selected;
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
