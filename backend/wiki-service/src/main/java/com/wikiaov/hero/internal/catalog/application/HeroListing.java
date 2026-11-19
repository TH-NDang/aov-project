package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroListView;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.authoring.persistence.entity.HeroIdentity;
import com.wikiaov.hero.internal.domain.HeroContent.Bindings;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Profile;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.media.MediaAssets;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

/**
 * The public hero list (ADR-024): heroes without forms and heroes that hold forms, each holder carrying its published
 * forms. With {@code playable}, it lists what players pick instead: heroes without forms and every form, each form
 * naming its holder; heroes that hold forms are left out.
 */
@Component
public class HeroListing {
    private final HeroStore store;
    private final HeroSections sections;
    private final MediaAssets media;
    private final HeroForms forms;
    private final HeroReadMoments moments;
    private final Clock clock;
    private final HeroReaderSelection selection;

    public HeroListing(HeroStore store, HeroSections sections, MediaAssets media, HeroForms forms,
            HeroReadMoments moments, Clock clock, HeroReaderSelection selection) {
        this.store = store;
        this.sections = sections;
        this.media = media;
        this.forms = forms;
        this.moments = moments;
        this.clock = clock;
        this.selection = selection;
    }

    HeroListView list(String region, String locale, int page, int size, String q, @Nullable String role, String sort,
            @Nullable UUID seasonId, @Nullable UUID patchVariantId, boolean includeUnscoped, boolean playable) {
        validateListQuery(locale, sort, q, role);

        Instant at = clock.instant();
        var moment = moments.resolve(region, at, seasonId, patchVariantId, includeUnscoped);
        var ctx = moment.context();
        var structure = forms.structure();
        var heroes = store.heroes(sort.endsWith("desc"));
        var codes = heroes.stream().collect(Collectors.toMap(HeroIdentity::getId, HeroIdentity::getCode));

        Map<UUID, Published> published = new LinkedHashMap<>();
        for (var hero : heroes) {
            selection.choose(hero.getId(), moment, at).ifPresent(
                    choice -> published.put(hero.getId(), published(hero, choice, locale)));
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
        var items = listMedia(selected.items());

        return new HeroListView(listContext(ctx, locale), selected.withItems(items));
    }

    private static void validateListQuery(String locale, String sort, String q, @Nullable String role) {
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
            formEntries.add(new ListEntry(formItem, member.bindingsId(), List.of()));
        }
        if (holder) {
            item.put("forms", formEntries.stream().map(ListEntry::item).toList());
        }
        if (playable) {
            structure.form(id).ifPresent(form -> item.put("parent",
                    Map.of("id", form.holderId(), "code", codes.get(form.holderId()), "formKey", form.formKey())));
        }

        return new ListEntry(item, hero.bindingsId(), formEntries);
    }

    private static HeroListView.Context listContext(GameplayContext c, String locale) {
        return new HeroListView.Context(c.regionCode(), locale,
                new HeroListView.Reference(c.rulesetId(), c.rulesetCode()),
                new HeroListView.Reference(c.patchId(), c.patchCode()), c.patchVariantId(), c.effectiveAt());
    }

    private Published published(HeroIdentity hero, HeroReadMoments.Choice<HeroRevisionView> choice, String locale) {
        var rev = choice.revision();
        var profile = (Profile) sections.content(HeroSection.PROFILE, rev.sections().get(HeroSection.PROFILE));
        String actual = HeroReaderSelection.profileLocale(profile, locale);
        var translated = profile.translations().stream().filter(t -> t.locale().equals(actual)).findFirst()
                .orElseThrow(() -> new IllegalStateException("The selected profile locale has no translation."));
        var later = selection.laterObservation(choice);
        return new Published(hero, rev, translated.name(), actual, profile.roles(), profile.positions(),
                rev.sections().get(HeroSection.MEDIA_BINDINGS), later);
    }

    private static <T> Set<T> union(List<Published> heroes, Function<Published, Set<T>> values) {
        Set<T> result = new LinkedHashSet<>();
        heroes.forEach(hero -> result.addAll(values.apply(hero)));
        return result;
    }

    /** Reads the head and portrait of every hero and form on the page in one batch. */
    private List<Map<String, Object>> listMedia(List<ListEntry> entries) {
        if (entries.isEmpty()) {
            return List.of();
        }

        var everyEntry = entries.stream().flatMap(entry -> Stream.concat(
                Stream.of(entry), entry.forms().stream())).toList();
        Map<UUID, Bindings> bindings = new HashMap<>();
        Set<UUID> assetIds = new HashSet<>();
        for (var entry : everyEntry) {
            var value = bindings.computeIfAbsent(entry.mediaBindingRevisionId(),
                    id -> (Bindings) sections.content(HeroSection.MEDIA_BINDINGS, id));
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = value.bindings().get(role);
                if (assetId != null) {
                    assetIds.add(assetId);
                }
            }
        }

        var assets = media.findAll(assetIds);
        for (var entry : everyEntry) {
            var selected = bindings.get(entry.mediaBindingRevisionId()).bindings();
            for (var role : List.of(MediaRole.HEAD, MediaRole.PORTRAIT)) {
                UUID assetId = selected.get(role);
                var asset = assetId == null ? null : assets.get(assetId);
                if (asset != null && asset.usable()) {
                    entry.item().put(role.name().toLowerCase(Locale.ROOT), asset);
                }
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
            @Nullable Map<String, Object> laterObservation
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
            if (laterObservation != null) {
                item.put("laterObservation", laterObservation);
            }
            return item;
        }
    }

    private record ListEntry(
            Map<String, Object> item,
            UUID mediaBindingRevisionId,
            List<ListEntry> forms
    ) {
    }
}
