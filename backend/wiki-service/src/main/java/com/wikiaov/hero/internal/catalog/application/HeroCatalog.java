package com.wikiaov.hero.internal.catalog.application;

import com.wikiaov.hero.internal.application.response.HeroCatalogView;
import com.wikiaov.hero.internal.application.response.HeroCatalogView.GameplayChange;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.catalog.domain.HeroCatalogFacets;
import com.wikiaov.hero.internal.catalog.persistence.HeroCatalogRepository;
import com.wikiaov.hero.internal.change.persistence.HeroPatchAssessmentRepository;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeSet;
import com.wikiaov.hero.internal.change.persistence.entity.HeroPatchChangeTranslation;
import com.wikiaov.hero.internal.domain.HeroChanges.ChangeSource;
import com.wikiaov.hero.internal.domain.HeroChanges.Kind;
import com.wikiaov.hero.internal.domain.HeroContent;
import com.wikiaov.hero.internal.domain.HeroContent.Position;
import com.wikiaov.hero.internal.domain.HeroContent.Role;
import com.wikiaov.hero.internal.forms.application.HeroForms;
import com.wikiaov.hero.internal.forms.domain.HeroFormStructure;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.RevisionState;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroCatalog {
    /** The catalog's query keeps its published values; a profile stores the code each one stands for. */
    private static final Map<String, Position> POSITION_CODES = Map.of("top", Position.TOP, "mid", Position.MID,
            "rung", Position.JUNGLE, "rong-ad", Position.DRAGON, "tro-thu", Position.SUPPORT);

    private final HeroPatchAssessmentRepository assessments;
    private final HeroCatalogRepository catalog;
    private final HeroStore store;
    private final GameplayContexts contexts;
    private final HeroForms forms;

    public HeroCatalog(HeroPatchAssessmentRepository assessments,
            HeroCatalogRepository catalog, HeroStore store, GameplayContexts contexts, HeroForms forms) {
        this.assessments = assessments;
        this.catalog = catalog;
        this.store = store;
        this.contexts = contexts;
        this.forms = forms;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public PageSlice<HeroCatalogView> list(int page, int size, String q, UUID seasonId, UUID patchVariantId,
            UUID rulesetId, String locale, String sort, boolean includeUnchanged, String role, String position,
            Boolean hasWarnings) {
        HeroValidation.requireReachableOffset(page, size);
        if (q.trim().length() > 100 || !Set.of("code", "edited-desc").contains(sort)) {
            throw HeroValidation.badQuery("Invalid hero catalog search or sort.");
        }
        HeroValidation.locale(locale);
        var facets = new HeroCatalogFacets(
                choices(role, Arrays.stream(Role.values()).map(Enum::name).collect(Collectors.toSet())).stream()
                        .map(Role::valueOf).collect(Collectors.toSet()),
                choices(position, POSITION_CODES.keySet()).stream().map(POSITION_CODES::get)
                        .collect(Collectors.toSet()),
                hasWarnings);
        if (rulesetId != null) {
            contexts.requireRuleset(rulesetId);
        }

        Map<UUID, PatchVariantReference> variants = contexts.catalogVariants(seasonId).stream()
                .filter(variant -> rulesetId == null || variant.rulesetId().equals(rulesetId))
                .collect(Collectors.toMap(PatchVariantReference::id, variant -> variant));
        if (patchVariantId != null) {
            contexts.variant(patchVariantId);
            if (!variants.containsKey(patchVariantId)) {
                throw HeroValidation.invalid("The selected patch does not belong to the selected season and ruleset.");
            }
            variants.keySet().removeIf(id -> !id.equals(patchVariantId));
        }

        boolean filtered = seasonId != null || patchVariantId != null;
        if (filtered && variants.isEmpty()) {
            return new PageSlice<>(List.of(), page, size, 0);
        }
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
        if (filtered && includeUnchanged && snapshotVariants.isEmpty()) {
            return new PageSlice<>(List.of(), page, size, 0);
        }

        var identities = catalog.page(new HeroCatalogRepository.Filter(q.trim().toLowerCase(Locale.ROOT), rulesetId,
                variants.keySet(), scopeOrdinals, filtered && !includeUnchanged, snapshotVariants, facets), page, size,
                sort.equals("edited-desc"));
        if (identities.items().isEmpty()) {
            return new PageSlice<>(List.of(), page, size, identities.totalElements());
        }

        var heroIds = identities.items().stream().map(hero -> hero.getId()).toList();
        var revisions = store.revisions(heroIds).stream()
                .filter(r -> !filtered || !includeUnchanged || r.state() == RevisionState.PUBLISHED
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
                    .add(row.getChangeKind()));
            translations.putAll(catalog.translations(changeIds).stream()
                    .collect(Collectors.groupingBy(HeroPatchChangeTranslation::getChangeSetId)));
        }

        var overall = assessments.findAllById(changeIds).stream()
                .collect(Collectors.toMap(a -> a.getChangeSetId(), a -> a.getKind()));
        Map<UUID, List<GameplayChange>> metadata = new HashMap<>();
        for (var change : selected) {
            var variant = variants.get(change.getPatchVariantId());
            var summary = translations.getOrDefault(change.getId(), List.of()).stream()
                    .min(CatalogLocales.preference(locale, HeroPatchChangeTranslation::getLocale));
            metadata.computeIfAbsent(change.getHeroId(), ignored -> new ArrayList<>())
                    .add(new GameplayChange(change.getId(), variant.rulesetId(), variant.seasonId(), variant.id(),
                            change.getFromHeroRevisionId(), change.getToHeroRevisionId(), change.getSourceKind(),
                            List.copyOf(classifications.getOrDefault(change.getId(), EnumSet.noneOf(Kind.class))),
                            overall.get(change.getId()), change.getCreatedAt(),
                            summary.map(HeroPatchChangeTranslation::getSummary).orElse(null),
                            summary.map(HeroPatchChangeTranslation::getLocale).orElse(null)));
        }

        var edited = catalog.editedTimes(heroIds);
        var structure = forms.structure();

        return identities.map(hero -> {
            var form = structure.form(hero.getId());
            return new HeroCatalogView(hero.getId(), hero.getCode(), revisions.getOrDefault(hero.getId(), List.of()),
                    latest(hero.getCreatedAt(), edited.get(hero.getId())),
                    metadata.getOrDefault(hero.getId(), List.of()),
                    form.map(HeroFormStructure.Form::holderId).orElse(null),
                    form.map(HeroFormStructure.Form::formKey).orElse(null),
                    structure.formsOf(hero.getId()).stream().map(HeroFormStructure.Form::heroId).toList());
        });
    }

    private static List<HeroPatchChangeSet> selectChanges(List<HeroPatchChangeSet> changes,
            Map<UUID, PatchVariantReference> variants, Map<UUID, HeroRevisionView> revisions, boolean filtered) {
        var ordered = changes.stream().filter(change -> {
            if (change.getSourceKind() == ChangeSource.PATCH_NOTES) {
                return true;
            }
            var revision = revisions.get(change.getToHeroRevisionId());
            return revision != null && revision.state() == RevisionState.PUBLISHED
                    && revision.cause() == HeroContent.Cause.GAME_PATCH;
        }).sorted(Comparator
                .<HeroPatchChangeSet>comparingLong(change -> variants.get(change.getPatchVariantId()).rulesetOrdinal())
                .reversed().thenComparing(HeroPatchChangeSet::getId)).toList();
        if (filtered) {
            return ordered;
        }
        Set<String> seen = new HashSet<>();
        return ordered.stream().filter(change -> seen.add(change.getHeroId() + ":"
                + variants.get(change.getPatchVariantId()).rulesetId())).toList();
    }

    private static Instant latest(Instant a, Instant b) {
        return a == null ? b : b == null || a.isAfter(b) ? a : b;
    }

    private static Set<String> choices(String value, Set<String> allowed) {
        if (value == null || value.isBlank()) {
            return Set.of();
        }
        var selected = Arrays.stream(value.split(",", -1)).map(String::trim).collect(Collectors.toSet());
        if (!allowed.containsAll(selected)) {
            throw HeroValidation.badQuery("Invalid hero catalog role or position.");
        }
        return Set.copyOf(selected);
    }
}
