package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroCatalogView;
import com.wikiaov.hero.internal.application.response.HeroCatalogView.GameplayChange;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.catalog.persistence.HeroCatalogRepository;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.PageSlice;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroCatalog {
    private final com.wikiaov.hero.internal.change.persistence.HeroPatchAssessmentRepository assessments;
    private final HeroCatalogRepository catalog;
    private final HeroStore store;
    private final GameplayContexts contexts;

    public HeroCatalog(com.wikiaov.hero.internal.change.persistence.HeroPatchAssessmentRepository assessments,
            HeroCatalogRepository catalog, HeroStore store, GameplayContexts contexts) {
        this.assessments = assessments;
        this.catalog = catalog;
        this.store = store;
        this.contexts = contexts;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<HeroCatalogView> list(int page, int size, String q, UUID seasonId, UUID patchVariantId,
            UUID rulesetId, String locale, String sort) {
        return list(page, size, q, seasonId, patchVariantId, rulesetId, locale, sort, false);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<HeroCatalogView> list(int page, int size, String q, UUID seasonId, UUID patchVariantId,
            UUID rulesetId, String locale, String sort, boolean includeUnchanged) {
        if (page < 0 || size < 1 || size > 100 || (long) page * size > Integer.MAX_VALUE)
            throw HeroValidation.invalid("Invalid page bounds.");
        if (q.trim().length() > 100 || !Set.of("code", "edited-desc").contains(sort))
            throw HeroValidation.invalid("Invalid hero catalog search or sort.");
        HeroValidation.locale(locale);
        if (rulesetId != null)
            contexts.requireRuleset(rulesetId);

        Map<UUID, PatchVariantReference> variants = contexts.catalogVariants(seasonId).stream()
                .filter(variant -> rulesetId == null || variant.rulesetId().equals(rulesetId))
                .collect(Collectors.toMap(PatchVariantReference::id, variant -> variant));
        if (patchVariantId != null) {
            contexts.variant(patchVariantId);
            if (!variants.containsKey(patchVariantId))
                throw HeroValidation.invalid("The selected patch does not belong to the selected season and ruleset.");
            variants.keySet().removeIf(id -> !id.equals(patchVariantId));
        }

        boolean filtered = seasonId != null || patchVariantId != null;
        if (filtered && variants.isEmpty())
            return new PageSlice<>(List.of(), page, size, 0);
        Map<UUID, Long> scopeOrdinals = variants.values().stream().collect(Collectors.toMap(
                PatchVariantReference::id, PatchVariantReference::rulesetOrdinal));
        Set<UUID> snapshotVariants = new HashSet<>();
        if (filtered && includeUnchanged) {
            Map<UUID, Long> cutoffs = new HashMap<>();
            variants.values().forEach(v -> cutoffs.merge(v.rulesetId(), v.rulesetOrdinal(), Math::max));
            contexts.catalogVariants(null).stream().filter(v -> v.published()
                    && v.rulesetOrdinal() <= cutoffs.getOrDefault(v.rulesetId(), -1L)).forEach(v -> {
                        snapshotVariants.add(v.id());
                        scopeOrdinals.put(v.id(), v.rulesetOrdinal());
                    });
        }
        if (filtered && includeUnchanged && snapshotVariants.isEmpty())
            return new PageSlice<>(List.of(), page, size, 0);

        var identities = catalog.page(new HeroCatalogRepository.Filter(q.trim().toLowerCase(Locale.ROOT), rulesetId,
                variants.keySet(), scopeOrdinals, filtered && !includeUnchanged, snapshotVariants), page, size,
                sort.equals("edited-desc"));
        if (identities.items().isEmpty())
            return new PageSlice<>(List.of(), page, size, identities.totalElements());

        var heroIds = identities.items().stream().map(hero -> hero.getId()).toList();
        var revisions = store.revisions(heroIds).stream()
                .filter(r -> !filtered || !includeUnchanged || r.state().equals("PUBLISHED")
                        && snapshotVariants.contains(r.effectiveFromPatchVariantId()))
                .collect(Collectors.groupingBy(HeroRevisionView::heroId));
        var byRevision = revisions.values().stream().flatMap(Collection::stream)
                .collect(Collectors.toMap(HeroRevisionView::id, revision -> revision));

        var changes = variants.isEmpty() ? List.<HeroPatchChangeSet>of() : catalog.changes(heroIds, variants.keySet());
        var selected = selectChanges(changes, variants, byRevision, filtered);
        var changeIds = selected.stream().map(HeroPatchChangeSet::getId).toList();
        Map<UUID, EnumSet<Kind>> classifications = new HashMap<>();
        Map<UUID, List<HeroPatchChangeTranslation>> translations = new HashMap<>();
        if (!changeIds.isEmpty()) {
            catalog.classifications(changeIds).forEach(row -> classifications
                    .computeIfAbsent(row.getChangeSetId(), ignored -> EnumSet.noneOf(Kind.class))
                    .add(Kind.valueOf(row.getChangeKind())));
            translations.putAll(catalog.translations(changeIds).stream()
                    .collect(Collectors.groupingBy(HeroPatchChangeTranslation::getChangeSetId)));
        }

        var overall = assessments.findAllById(changeIds).stream()
                .collect(Collectors.toMap(a -> a.getChangeSetId(), a -> a.getKind()));
        Map<UUID, List<GameplayChange>> metadata = new HashMap<>();
        for (var change : selected) {
            var variant = variants.get(change.getPatchVariantId());
            var summary = translations.getOrDefault(change.getId(), List.of()).stream()
                    .min(Comparator.<HeroPatchChangeTranslation>comparingInt(t -> t.getLocale().equals(locale)
                            ? 0
                            : t.getLocale().equals("vi-VN") ? 1 : 2)
                            .thenComparing(HeroPatchChangeTranslation::getLocale));
            metadata.computeIfAbsent(change.getHeroId(), ignored -> new ArrayList<>())
                    .add(new GameplayChange(change.getId(), variant.rulesetId(), variant.seasonId(), variant.id(),
                            change.getFromHeroRevisionId(), change.getToHeroRevisionId(),
                            List.copyOf(classifications.getOrDefault(change.getId(), EnumSet.noneOf(Kind.class))),
                            overall.get(change.getId()), change.getCreatedAt(),
                            summary.map(HeroPatchChangeTranslation::getSummary).orElse(null),
                            summary.map(HeroPatchChangeTranslation::getLocale).orElse(null)));
        }

        var edited = catalog.editedTimes(heroIds);

        return identities.map(hero -> new HeroCatalogView(hero.getId(), hero.getCode(),
                revisions.getOrDefault(hero.getId(), List.of()), latest(hero.getCreatedAt(), edited.get(hero.getId())),
                metadata.getOrDefault(hero.getId(), List.of())));
    }

    private static List<HeroPatchChangeSet> selectChanges(List<HeroPatchChangeSet> changes,
            Map<UUID, PatchVariantReference> variants, Map<UUID, HeroRevisionView> revisions, boolean filtered) {
        var ordered = changes.stream().filter(change -> {
            var revision = revisions.get(change.getToHeroRevisionId());
            return revision != null && revision.state().equals("PUBLISHED")
                    && revision.cause() == com.wikiaov.hero.internal.domain.HeroContent.Cause.GAME_PATCH;
        }).sorted(Comparator
                .<HeroPatchChangeSet>comparingLong(change -> variants.get(change.getPatchVariantId()).rulesetOrdinal())
                .reversed().thenComparing(HeroPatchChangeSet::getId)).toList();
        if (filtered)
            return ordered;
        Set<String> seen = new HashSet<>();
        return ordered.stream().filter(change -> seen.add(change.getHeroId() + ":"
                + variants.get(change.getPatchVariantId()).rulesetId())).toList();
    }

    private static Instant latest(Instant a, Instant b) {
        return a == null ? b : b == null || a.isAfter(b) ? a : b;
    }
}
