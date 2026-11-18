package com.wikiaov.item.internal.catalog.application;

import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemTranslationRepository;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemTranslation;
import com.wikiaov.item.internal.change.persistence.ItemPatchChangeRepository;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.CatalogReadScope;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.CatalogObservation;
import com.wikiaov.platform.CatalogSnapshots;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/** Read-side snapshot selection, search, and catalog projections. */
@Component
class ItemCatalogQueries {
    private final ItemPatchChangeRepository patchChanges;
    private final ItemIdentityRepository identities;
    private final ItemRevisionRepository revisions;
    private final ItemTranslationRepository translations;
    private final GameplayContexts contexts;
    private final Clock clock;
    private final ItemRevisionContent revisionContent;
    private final ItemContentRules contentRules;
    private final ItemPublicMedia publicMedia;

    ItemCatalogQueries(ItemPatchChangeRepository patchChanges, ItemIdentityRepository identities,
            ItemRevisionRepository revisions, ItemTranslationRepository translations, GameplayContexts contexts,
            Clock clock, ItemRevisionContent revisionContent, ItemContentRules contentRules,
            ItemPublicMedia publicMedia) {
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.contexts = contexts;
        this.clock = clock;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
        this.publicMedia = publicMedia;
    }

    PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }

    PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }

    PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged, false, false);
    }

    PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged, boolean includeUnscoped, boolean draftsOnly) {
        if (rulesetId != null) {
            contexts.requireRuleset(rulesetId);
        }
        String needle = q.strip().toLowerCase(Locale.ROOT);
        var candidates = activeSnapshots(rulesetId, draftsOnly);
        var scoped = snapshotsInScope(candidates, rulesetId, seasonId, patchVariantId, includeUnchanged,
                includeUnscoped);
        var selected = CatalogSnapshots.latestByOwner(scoped, this::patchOrdinal);
        var copies = translationsFor(selected);
        var owners = matchingOwners(selected, copies, needle);
        return requestedPage(owners, selected, copies, page, size);
    }

    private List<CatalogSnapshots.Snapshot<ItemRevision>> activeSnapshots(UUID rulesetId, boolean draftsOnly) {
        var records = draftsOnly
                ? revisions.findByRulesetIdAndState(rulesetId, RevisionState.DRAFT)
                : revisions.findByStateNot(RevisionState.DISCARDED);
        return records.stream()
                .filter(revision -> rulesetId == null || revision.getRulesetId().equals(rulesetId))
                .map(revision -> new CatalogSnapshots.Snapshot<>(revision.getId(), revision.getOwnerId(),
                        revision.getEffectiveFromPatchVariantId(), revision.getRevisionNo(), revision.getState(),
                        revision.getCause(), revision))
                .toList();
    }

    private List<CatalogSnapshots.Snapshot<ItemRevision>> snapshotsInScope(
            List<CatalogSnapshots.Snapshot<ItemRevision>> candidates, UUID rulesetId,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged, boolean includeUnscoped) {
        if (seasonId == null && patchVariantId == null) {
            return candidates;
        }
        var scope = CatalogPatchScope.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
        if (includeUnchanged) {
            return carriedForwardSnapshots(candidates, scope, includeUnscoped);
        }
        return changedSnapshots(candidates, rulesetId, scope.selectedPatchIds());
    }

    private List<CatalogSnapshots.Snapshot<ItemRevision>> carriedForwardSnapshots(
            List<CatalogSnapshots.Snapshot<ItemRevision>> candidates, CatalogPatchScope scope,
            boolean includeUnscoped) {
        var allowed = scope.selectedPatchIds();
        var applicable = scope.applicablePatchIds();
        var changes = patchChanges.findAll().stream()
                .map(f -> new CatalogSnapshots.Change(f.getOwnerId(), f.getPatchVariantId(),
                        f.getKinds().contains(CatalogChanges.Kind.REMOVED)))
                .toList();
        return CatalogSnapshots.carriedForward(candidates, allowed, applicable, changes, this::patchOrdinal,
                includeUnscoped);

    }

    private List<CatalogSnapshots.Snapshot<ItemRevision>> changedSnapshots(
            List<CatalogSnapshots.Snapshot<ItemRevision>> candidates, UUID rulesetId, Set<UUID> allowed) {
        var explicitTargets = patchChanges.findAll().stream()
                .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                        && allowed.contains(f.getPatchVariantId()))
                .map(f -> f.getToRevisionId()).collect(Collectors.toSet());
        return CatalogSnapshots.changedAt(candidates, allowed, explicitTargets);
    }

    private Map<UUID, List<ItemTranslation>> translationsFor(Map<UUID, ItemRevision> selected) {
        return translations.findByRevisionIdIn(selected.values().stream().map(ItemRevision::getId).toList())
                .stream()
                .collect(Collectors.groupingBy(ItemTranslation::getRevisionId));
    }

    private List<ItemIdentity> matchingOwners(Map<UUID, ItemRevision> selected,
            Map<UUID, List<ItemTranslation>> copies, String needle) {
        return identities.findAll(Sort.by("code")).stream().filter(owner -> selected.containsKey(owner.getId()))
                .filter(owner -> needle.isEmpty() || owner.getCode().contains(needle)
                        || copies.getOrDefault(selected.get(owner.getId()).getId(), List.of()).stream()
                                .anyMatch(
                                        translation -> translation.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .toList();
    }

    private PageSlice<ItemView> requestedPage(List<ItemIdentity> owners, Map<UUID, ItemRevision> selected,
            Map<UUID, List<ItemTranslation>> copies, int page, int size) {
        return PageSlice.of(owners, page, size).map(owner -> {
            var revision = selected.get(owner.getId());
            var copy = copies.getOrDefault(revision.getId(), List.of());
            var c = revisionContent.hydrate(revision, copy);
            return new ItemView(owner.getId(), owner.getCode(), revisionContent.revisionView(owner, revision), c,
                    contentRules.readiness(revision, c));
        });
    }

    ItemView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null) {
            throw new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "No snapshot is available.");
        }
        return found;
    }

    ItemView read(UUID id, UUID revisionId) {
        return revisionContent.view(identity(id), revision(id, revisionId));
    }

    List<ItemView.Revision> history(UUID id) {
        var owner = identity(id);
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .map(revision -> revisionContent.revisionView(owner, revision)).toList();
    }

    List<MediaUsage> usages(UUID assetId) {
        var active = contexts.active(clock.instant());
        var found = revisions.findAll().stream()
                .filter(revision -> revision.getState() != RevisionState.DISCARDED
                        && contentRules.assets(revision.getGameplay()).contains(assetId))
                .toList();
        var names = usageNames(found);

        return found.stream().map(revision -> usage(revision, active).named(names.get(revision.getId()), null))
                .toList();
    }

    Map<UUID, List<MediaUsage>> allUsages() {
        var active = contexts.active(clock.instant());
        Map<UUID, List<MediaUsage>> usages = new HashMap<>();

        for (var revision : revisions.findAll()) {
            var assets = revision.getState() == RevisionState.DISCARDED
                    ? List.<UUID>of()
                    : contentRules.assets(revision.getGameplay());
            if (assets.isEmpty()) {
                continue;
            }
            var usage = usage(revision, active);
            assets.forEach(asset -> usages.computeIfAbsent(asset, ignored -> new ArrayList<>()).add(usage));
        }

        return usages;
    }

    private MediaUsage usage(ItemRevision revision, List<GameplayContext> active) {
        boolean current = revision.getState() == RevisionState.PUBLISHED
                && active.stream().filter(c -> c.rulesetId().equals(revision.getRulesetId()))
                        .anyMatch(c -> current(revision.getOwnerId(), c).map(v -> v.getId().equals(revision.getId()))
                                .orElse(false));

        return new MediaUsage("ITEM", "ITEM", revision.getOwnerId(), revision.getId(), "ICON",
                revision.getState() == RevisionState.DRAFT
                        ? MediaUsageScope.DRAFT
                        : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
    }

    /** The name of each revision for Admin, which reads Vietnamese, falling back as a reader of that locale would. */
    private Map<UUID, String> usageNames(List<ItemRevision> found) {
        if (found.isEmpty()) {
            return Map.of();
        }

        Map<UUID, String> names = new HashMap<>();
        translations.findByRevisionIdIn(found.stream().map(ItemRevision::getId).toList()).stream()
                .sorted(CatalogLocales.preference(CatalogLocales.DEFAULT, ItemTranslation::getLocale))
                .forEach(row -> names.putIfAbsent(row.getRevisionId(), row.getName()));

        return names;
    }

    PageSlice<ItemView> published(String region, String locale, int page, int size) {
        return published(region, locale, page, size, null, null, false);
    }

    PageSlice<ItemView> published(String region, String locale, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(owner -> current(owner.getId(), context)
                        .filter(revision -> scope.allowUnscoped() || revision.getEffectiveFromPatchVariantId() != null)
                        .map(revision -> revisionContent.publicView(owner, revision, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        var slice = PageSlice.of(rows, page, size);
        return slice.withItems(publicMedia.hydrate(slice.items()));
    }

    ItemView publishedOne(UUID id, String region, String locale) {
        return publishedOne(id, region, locale, null, null, false);
    }

    ItemView publishedOne(UUID id, String region, String locale,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var owner = identity(id);
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        return current(id, context)
                .filter(revision -> scope.allowUnscoped() || revision.getEffectiveFromPatchVariantId() != null)
                .map(revision -> revisionContent.publicView(owner, revision, locale))
                .map(publicMedia::hydrate).orElseThrow(
                        () -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "No published snapshot is available."));
    }

    Optional<ItemRevision> current(UUID id, GameplayContext context) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(context.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= context.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED)) {
            return Optional.empty();
        }
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(revision -> revision.getState() == RevisionState.PUBLISHED
                        && (revision.getEffectiveFromPatchVariantId() != null || CatalogObservation.isUnscopedBaseline(
                                revision.getCause(), revision.getSourceRevisionId(), null))
                        && revision.getRulesetId().equals(context.rulesetId())
                        && patchOrdinal(revision) <= context.rulesetOrdinal())
                .max(Comparator.<ItemRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(revision -> revision.getPublicationSequence() == null
                                ? 0
                                : revision.getPublicationSequence()));
    }

    ItemView latest(ItemIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(revision -> revision.getState() != RevisionState.DISCARDED
                        && (rulesetId == null || revision.getRulesetId().equals(rulesetId)))
                .max(Comparator.<ItemRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(ItemRevision::getRevisionNo))
                .map(revision -> revisionContent.view(owner, revision)).orElse(null);
    }

    ItemIdentity identity(UUID id) {
        return identities.findById(id)
                .orElseThrow(() -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "The catalog entry was not found."));
    }

    ItemRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(revision -> revision.getOwnerId().equals(id)).orElseThrow(
                () -> new ApiException(ItemErrorCode.ITEM_REVISION_NOT_FOUND, "The revision was not found."));
    }

    long patchOrdinal(ItemRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    long patchOrdinal(UUID id) {
        return GameplayContexts.rulesetOrdinal(contexts, id);
    }
}
