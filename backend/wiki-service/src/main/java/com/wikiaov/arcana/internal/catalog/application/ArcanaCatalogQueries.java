package com.wikiaov.arcana.internal.catalog.application;

import com.wikiaov.arcana.internal.application.ArcanaErrorCode;
import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaIdentityRepository;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaRevisionRepository;
import com.wikiaov.arcana.internal.catalog.persistence.ArcanaTranslationRepository;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaIdentity;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaRevision;
import com.wikiaov.arcana.internal.catalog.persistence.entity.ArcanaTranslation;
import com.wikiaov.arcana.internal.change.persistence.ArcanaPatchChangeRepository;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogSnapshots;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Clock;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Component;

/** Read-side snapshot selection, search, and catalog projections. */
@Component
class ArcanaCatalogQueries {
    private final ArcanaPatchChangeRepository patchChanges;
    private final ArcanaIdentityRepository identities;
    private final ArcanaRevisionRepository revisions;
    private final ArcanaTranslationRepository translations;
    private final GameplayContexts contexts;
    private final Clock clock;
    private final ArcanaRevisionContent revisionContent;
    private final ArcanaContentRules contentRules;

    ArcanaCatalogQueries(ArcanaPatchChangeRepository patchChanges, ArcanaIdentityRepository identities,
            ArcanaRevisionRepository revisions, ArcanaTranslationRepository translations, GameplayContexts contexts,
            Clock clock, ArcanaRevisionContent revisionContent, ArcanaContentRules contentRules) {
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.contexts = contexts;
        this.clock = clock;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
    }

    PageSlice<ArcanaView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }

    PageSlice<ArcanaView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }

    PageSlice<ArcanaView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        requirePageBounds(page, size);
        if (rulesetId != null)
            contexts.requireRuleset(rulesetId);
        String needle = q.strip().toLowerCase(Locale.ROOT);
        var candidates = activeSnapshots(rulesetId);
        var scoped = snapshotsInScope(candidates, rulesetId, seasonId, patchVariantId, includeUnchanged);
        var selected = CatalogSnapshots.latestByOwner(scoped, this::patchOrdinal);
        var copies = translationsFor(selected);
        var owners = matchingOwners(selected, copies, needle);
        return requestedPage(owners, selected, copies, page, size);
    }

    private void requirePageBounds(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
    }

    private List<CatalogSnapshots.Snapshot<ArcanaRevision>> activeSnapshots(UUID rulesetId) {
        return revisions.findByStateNot("DISCARDED").stream()
                .filter(revision -> rulesetId == null || revision.getRulesetId().equals(rulesetId))
                .map(revision -> new CatalogSnapshots.Snapshot<>(revision.getId(), revision.getOwnerId(),
                        revision.getEffectiveFromPatchVariantId(), revision.getRevisionNo(), revision.getState(),
                        revision.getCause(), revision))
                .toList();
    }

    private List<CatalogSnapshots.Snapshot<ArcanaRevision>> snapshotsInScope(
            List<CatalogSnapshots.Snapshot<ArcanaRevision>> candidates, UUID rulesetId,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        if (seasonId == null && patchVariantId == null)
            return candidates;
        var scope = CatalogPatchScope.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
        if (includeUnchanged)
            return carriedForwardSnapshots(candidates, scope);
        return changedSnapshots(candidates, rulesetId, scope.selectedPatchIds());
    }

    private List<CatalogSnapshots.Snapshot<ArcanaRevision>> carriedForwardSnapshots(
            List<CatalogSnapshots.Snapshot<ArcanaRevision>> candidates, CatalogPatchScope scope) {
        var allowed = scope.selectedPatchIds();
        var applicable = scope.applicablePatchIds();
        var changes = patchChanges.findAll().stream()
                .map(f -> new CatalogSnapshots.Change(f.getOwnerId(), f.getPatchVariantId(),
                        f.getKinds().contains(CatalogChanges.Kind.REMOVED)))
                .toList();
        return CatalogSnapshots.carriedForward(candidates, allowed, applicable, changes, this::patchOrdinal);

    }

    private List<CatalogSnapshots.Snapshot<ArcanaRevision>> changedSnapshots(
            List<CatalogSnapshots.Snapshot<ArcanaRevision>> candidates, UUID rulesetId, Set<UUID> allowed) {
        var explicitTargets = patchChanges.findAll().stream()
                .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                        && allowed.contains(f.getPatchVariantId()))
                .map(f -> f.getToRevisionId()).collect(java.util.stream.Collectors.toSet());
        return CatalogSnapshots.changedAt(candidates, allowed, explicitTargets);
    }

    private Map<UUID, List<ArcanaTranslation>> translationsFor(Map<UUID, ArcanaRevision> selected) {
        return translations.findByRevisionIdIn(selected.values().stream().map(ArcanaRevision::getId).toList())
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(ArcanaTranslation::getRevisionId));
    }

    private List<ArcanaIdentity> matchingOwners(Map<UUID, ArcanaRevision> selected,
            Map<UUID, List<ArcanaTranslation>> copies, String needle) {
        return identities.findAll(Sort.by("code")).stream().filter(owner -> selected.containsKey(owner.getId()))
                .filter(owner -> needle.isEmpty() || owner.getCode().contains(needle)
                        || copies.getOrDefault(selected.get(owner.getId()).getId(), List.of()).stream()
                                .anyMatch(
                                        translation -> translation.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .toList();
    }

    private PageSlice<ArcanaView> requestedPage(List<ArcanaIdentity> owners, Map<UUID, ArcanaRevision> selected,
            Map<UUID, List<ArcanaTranslation>> copies, int page, int size) {
        int start = (int) Math.min((long) page * size, owners.size());
        var pageRows = owners.subList(start, Math.min(start + size, owners.size())).stream().map(owner -> {
            var revision = selected.get(owner.getId());
            var copy = copies.getOrDefault(revision.getId(), List.of());
            var c = revisionContent.hydrate(revision, copy);
            return new ArcanaView(owner.getId(), owner.getCode(), revisionContent.revisionView(owner, revision), c,
                    contentRules.readiness(revision, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }

    ArcanaView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(ArcanaErrorCode.ARCANA_NOT_FOUND, "No snapshot is available.");
        return found;
    }

    ArcanaView read(UUID id, UUID revisionId) {
        return revisionContent.view(identity(id), revision(id, revisionId));
    }

    List<ArcanaView.Revision> history(UUID id) {
        var owner = identity(id);
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .map(revision -> revisionContent.revisionView(owner, revision)).toList();
    }

    List<MediaUsage> usages(UUID assetId) {
        var active = contexts.active(clock.instant());
        return revisions.findAll().stream()
                .filter(revision -> !revision.getState().equals("DISCARDED")
                        && contentRules.assets(revision.getGameplay()).contains(assetId))
                .map(revision -> {
                    boolean current = active.stream().filter(c -> c.rulesetId().equals(revision.getRulesetId()))
                            .anyMatch(
                                    c -> current(revision.getOwnerId(), c).map(v -> v.getId().equals(revision.getId()))
                                            .orElse(false));
                    return new MediaUsage("ARCANA", "ARCANA", revision.getOwnerId(), revision.getId(), "ICON",
                            revision.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }

    PageSlice<ArcanaView> published(String region, String locale, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var context = contexts.resolve(region, clock.instant());
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(owner -> current(owner.getId(), context)
                        .map(revision -> revisionContent.publicView(owner, revision, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        int start = (int) Math.min((long) page * size, rows.size());
        return new PageSlice<>(rows.subList(start, Math.min(start + size, rows.size())), page, size, rows.size());
    }

    ArcanaView publishedOne(UUID id, String region, String locale) {
        var owner = identity(id);
        var context = contexts.resolve(region, clock.instant());
        return current(id, context).map(revision -> revisionContent.publicView(owner, revision, locale)).orElseThrow(
                () -> new ApiException(ArcanaErrorCode.ARCANA_NOT_FOUND, "No published snapshot is available."));
    }

    Optional<ArcanaRevision> current(UUID id, GameplayContext context) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(context.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= context.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED))
            return Optional.empty();
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(revision -> revision.getState().equals("PUBLISHED")
                        && revision.getRulesetId().equals(context.rulesetId())
                        && patchOrdinal(revision) <= context.rulesetOrdinal())
                .max(Comparator.<ArcanaRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(revision -> revision.getPublicationSequence() == null
                                ? 0
                                : revision.getPublicationSequence()));
    }

    ArcanaView latest(ArcanaIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(revision -> !revision.getState().equals("DISCARDED")
                        && (rulesetId == null || revision.getRulesetId().equals(rulesetId)))
                .max(Comparator.<ArcanaRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(ArcanaRevision::getRevisionNo))
                .map(revision -> revisionContent.view(owner, revision)).orElse(null);
    }

    ArcanaIdentity identity(UUID id) {
        return identities.findById(id).orElseThrow(
                () -> new ApiException(ArcanaErrorCode.ARCANA_NOT_FOUND, "The catalog entry was not found."));
    }

    ArcanaRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(revision -> revision.getOwnerId().equals(id)).orElseThrow(
                () -> new ApiException(ArcanaErrorCode.ARCANA_REVISION_NOT_FOUND, "The revision was not found."));
    }

    long patchOrdinal(ArcanaRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }
}
