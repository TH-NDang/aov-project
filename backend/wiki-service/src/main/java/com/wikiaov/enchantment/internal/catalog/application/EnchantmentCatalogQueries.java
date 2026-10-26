package com.wikiaov.enchantment.internal.catalog.application;

import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentIdentityRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentTranslationRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentTranslation;
import com.wikiaov.enchantment.internal.change.persistence.EnchantmentPatchChangeRepository;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.CatalogReadScope;
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
class EnchantmentCatalogQueries {
    private final EnchantmentPatchChangeRepository patchChanges;
    private final EnchantmentIdentityRepository identities;
    private final EnchantmentRevisionRepository revisions;
    private final EnchantmentTranslationRepository translations;
    private final GameplayContexts contexts;
    private final Clock clock;
    private final EnchantmentRevisionContent revisionContent;
    private final EnchantmentContentRules contentRules;
    private final EnchantmentPublicMedia publicMedia;

    EnchantmentCatalogQueries(EnchantmentTranslationRepository translations,
            EnchantmentPatchChangeRepository patchChanges, EnchantmentIdentityRepository identities,
            EnchantmentRevisionRepository revisions, GameplayContexts contexts, Clock clock,
            EnchantmentRevisionContent revisionContent, EnchantmentContentRules contentRules,
            EnchantmentPublicMedia publicMedia) {
        this.translations = translations;
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.contexts = contexts;
        this.clock = clock;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
        this.publicMedia = publicMedia;
    }

    PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }

    PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }

    PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
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

    private List<CatalogSnapshots.Snapshot<EnchantmentRevision>> activeSnapshots(UUID rulesetId) {
        return revisions.findByStateNot("DISCARDED").stream()
                .filter(revision -> rulesetId == null || revision.getRulesetId().equals(rulesetId))
                .map(revision -> new CatalogSnapshots.Snapshot<>(revision.getId(), revision.getOwnerId(),
                        revision.getEffectiveFromPatchVariantId(), revision.getRevisionNo(), revision.getState(),
                        revision.getCause(), revision))
                .toList();
    }

    private List<CatalogSnapshots.Snapshot<EnchantmentRevision>> snapshotsInScope(
            List<CatalogSnapshots.Snapshot<EnchantmentRevision>> candidates, UUID rulesetId,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        if (seasonId == null && patchVariantId == null)
            return candidates;
        var scope = CatalogPatchScope.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
        if (includeUnchanged)
            return carriedForwardSnapshots(candidates, scope);
        return changedSnapshots(candidates, rulesetId, scope.selectedPatchIds());
    }

    private List<CatalogSnapshots.Snapshot<EnchantmentRevision>> carriedForwardSnapshots(
            List<CatalogSnapshots.Snapshot<EnchantmentRevision>> candidates, CatalogPatchScope scope) {
        var allowed = scope.selectedPatchIds();
        var applicable = scope.applicablePatchIds();
        var changes = patchChanges.findAll().stream()
                .map(f -> new CatalogSnapshots.Change(f.getOwnerId(), f.getPatchVariantId(),
                        f.getKinds().contains(CatalogChanges.Kind.REMOVED)))
                .toList();
        return CatalogSnapshots.carriedForward(candidates, allowed, applicable, changes, this::patchOrdinal);

    }

    private List<CatalogSnapshots.Snapshot<EnchantmentRevision>> changedSnapshots(
            List<CatalogSnapshots.Snapshot<EnchantmentRevision>> candidates, UUID rulesetId, Set<UUID> allowed) {
        var explicitTargets = patchChanges.findAll().stream()
                .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                        && allowed.contains(f.getPatchVariantId()))
                .map(f -> f.getToRevisionId()).collect(java.util.stream.Collectors.toSet());
        return CatalogSnapshots.changedAt(candidates, allowed, explicitTargets);
    }

    private Map<UUID, List<EnchantmentTranslation>> translationsFor(Map<UUID, EnchantmentRevision> selected) {
        return translations
                .findByRevisionIdIn(selected.values().stream().map(EnchantmentRevision::getId).toList()).stream()
                .collect(java.util.stream.Collectors.groupingBy(EnchantmentTranslation::getRevisionId));
    }

    private List<EnchantmentIdentity> matchingOwners(Map<UUID, EnchantmentRevision> selected,
            Map<UUID, List<EnchantmentTranslation>> copies, String needle) {
        return identities.findAll(Sort.by("code")).stream().filter(owner -> selected.containsKey(owner.getId()))
                .filter(owner -> needle.isEmpty() || owner.getCode().contains(needle)
                        || copies.getOrDefault(selected.get(owner.getId()).getId(), List.of()).stream()
                                .anyMatch(
                                        translation -> translation.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .toList();
    }

    private PageSlice<EnchantmentView> requestedPage(List<EnchantmentIdentity> owners,
            Map<UUID, EnchantmentRevision> selected,
            Map<UUID, List<EnchantmentTranslation>> copies, int page, int size) {
        int start = (int) Math.min((long) page * size, owners.size());
        var pageRows = owners.subList(start, Math.min(start + size, owners.size())).stream().map(owner -> {
            var revision = selected.get(owner.getId());
            var copy = copies.getOrDefault(revision.getId(), List.of());
            var c = revisionContent.hydrate(revision, copy);
            return new EnchantmentView(owner.getId(), owner.getCode(), revisionContent.revisionView(owner, revision), c,
                    contentRules.readiness(revision, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }

    EnchantmentView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "No snapshot is available.");
        return found;
    }

    EnchantmentView read(UUID id, UUID revisionId) {
        return revisionContent.view(identity(id), revision(id, revisionId));
    }

    List<EnchantmentView.Revision> history(UUID id) {
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
                    return new MediaUsage("ENCHANTMENT", "ENCHANTMENT", revision.getOwnerId(), revision.getId(), "ICON",
                            revision.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }

    PageSlice<EnchantmentView> published(String region, String locale, int page, int size) {
        return published(region, locale, page, size, null, null, false);
    }

    PageSlice<EnchantmentView> published(String region, String locale, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(owner -> current(owner.getId(), context)
                        .filter(revision -> scope.allowUnscoped() || revision.getEffectiveFromPatchVariantId() != null)
                        .map(revision -> revisionContent.publicView(owner, revision, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        int start = (int) Math.min((long) page * size, rows.size());
        return new PageSlice<>(publicMedia.hydrate(rows.subList(start, Math.min(start + size, rows.size()))), page,
                size, rows.size());
    }

    EnchantmentView publishedOne(UUID id, String region, String locale) {
        return publishedOne(id, region, locale, null, null, false);
    }

    EnchantmentView publishedOne(UUID id, String region, String locale,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var owner = identity(id);
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        return current(id, context)
                .filter(revision -> scope.allowUnscoped() || revision.getEffectiveFromPatchVariantId() != null)
                .map(revision -> revisionContent.publicView(owner, revision, locale))
                .map(publicMedia::hydrate)
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND,
                        "No published snapshot is available."));
    }

    Optional<EnchantmentRevision> current(UUID id, GameplayContext context) {
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
                .max(Comparator.<EnchantmentRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(revision -> revision.getPublicationSequence() == null
                                ? 0
                                : revision.getPublicationSequence()));
    }

    EnchantmentView latest(EnchantmentIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(revision -> !revision.getState().equals("DISCARDED")
                        && (rulesetId == null || revision.getRulesetId().equals(rulesetId)))
                .max(Comparator.<EnchantmentRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(EnchantmentRevision::getRevisionNo))
                .map(revision -> revisionContent.view(owner, revision)).orElse(null);
    }

    EnchantmentIdentity identity(UUID id) {
        return identities.findById(id).orElseThrow(
                () -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "The catalog entry was not found."));
    }

    EnchantmentRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(revision -> revision.getOwnerId().equals(id))
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_REVISION_NOT_FOUND,
                        "The revision was not found."));
    }

    long patchOrdinal(EnchantmentRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }
}
