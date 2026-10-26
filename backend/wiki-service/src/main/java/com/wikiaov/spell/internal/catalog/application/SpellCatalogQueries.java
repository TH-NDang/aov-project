package com.wikiaov.spell.internal.catalog.application;

import com.wikiaov.media.MediaUsage;
import com.wikiaov.media.MediaUsageScope;
import com.wikiaov.patch.CatalogPatchScope;
import com.wikiaov.patch.CatalogReadScope;
import com.wikiaov.patch.GameplayContext;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogObservation;
import com.wikiaov.platform.CatalogSnapshots;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.PlatformErrorCode;
import com.wikiaov.spell.internal.application.SpellErrorCode;
import com.wikiaov.spell.internal.application.response.SpellRemovalView;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.catalog.persistence.SpellIdentityRepository;
import com.wikiaov.spell.internal.catalog.persistence.SpellRevisionRepository;
import com.wikiaov.spell.internal.catalog.persistence.SpellTranslationRepository;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellRevision;
import com.wikiaov.spell.internal.catalog.persistence.entity.SpellTranslation;
import com.wikiaov.spell.internal.change.persistence.SpellPatchChangeRepository;
import com.wikiaov.spell.internal.change.persistence.SpellRemovalRepository;
import java.time.Clock;
import java.util.Comparator;
import java.util.LinkedHashMap;
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
class SpellCatalogQueries {
    private final SpellPatchChangeRepository patchChanges;
    private final SpellIdentityRepository identities;
    private final SpellRevisionRepository revisions;
    private final SpellTranslationRepository translations;
    private final SpellRemovalRepository removals;
    private final GameplayContexts contexts;
    private final Clock clock;
    private final SpellRevisionContent revisionContent;
    private final SpellContentRules contentRules;
    private final SpellPublicMedia publicMedia;

    SpellCatalogQueries(SpellPatchChangeRepository patchChanges, SpellIdentityRepository identities,
            SpellRevisionRepository revisions, SpellTranslationRepository translations, SpellRemovalRepository removals,
            GameplayContexts contexts, Clock clock, SpellRevisionContent revisionContent,
            SpellContentRules contentRules, SpellPublicMedia publicMedia) {
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.removals = removals;
        this.contexts = contexts;
        this.clock = clock;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
        this.publicMedia = publicMedia;
    }

    PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }

    PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }

    PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
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

    private List<CatalogSnapshots.Snapshot<SpellRevision>> activeSnapshots(UUID rulesetId) {
        return revisions.findByStateNot("DISCARDED").stream()
                .filter(revision -> rulesetId == null || revision.getRulesetId().equals(rulesetId))
                .map(revision -> new CatalogSnapshots.Snapshot<>(revision.getId(), revision.getOwnerId(),
                        revision.getEffectiveFromPatchVariantId(), revision.getRevisionNo(), revision.getState(),
                        revision.getCause(), revision))
                .toList();
    }

    private List<CatalogSnapshots.Snapshot<SpellRevision>> snapshotsInScope(
            List<CatalogSnapshots.Snapshot<SpellRevision>> candidates, UUID rulesetId,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        if (seasonId == null && patchVariantId == null)
            return candidates;
        var scope = CatalogPatchScope.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
        if (includeUnchanged)
            return carriedForwardSnapshots(candidates, scope);
        return changedSnapshots(candidates, rulesetId, scope.selectedPatchIds());
    }

    private List<CatalogSnapshots.Snapshot<SpellRevision>> carriedForwardSnapshots(
            List<CatalogSnapshots.Snapshot<SpellRevision>> candidates, CatalogPatchScope scope) {
        var allowed = scope.selectedPatchIds();
        var applicable = scope.applicablePatchIds();
        var changes = patchChanges.findAll().stream()
                .map(f -> new CatalogSnapshots.Change(f.getOwnerId(), f.getPatchVariantId(),
                        f.getKinds().contains(CatalogChanges.Kind.REMOVED)))
                .toList();
        return CatalogSnapshots.carriedForward(candidates, allowed, applicable, changes, this::patchOrdinal);

    }

    private List<CatalogSnapshots.Snapshot<SpellRevision>> changedSnapshots(
            List<CatalogSnapshots.Snapshot<SpellRevision>> candidates, UUID rulesetId, Set<UUID> allowed) {
        var explicitTargets = patchChanges.findAll().stream()
                .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                        && allowed.contains(f.getPatchVariantId()))
                .map(f -> f.getToRevisionId()).collect(java.util.stream.Collectors.toSet());
        removals.findAll().stream().filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                && allowed.contains(f.getPatchVariantId())).map(f -> f.getRevisionId())
                .forEach(explicitTargets::add);
        return CatalogSnapshots.changedAt(candidates, allowed, explicitTargets);
    }

    private Map<UUID, List<SpellTranslation>> translationsFor(Map<UUID, SpellRevision> selected) {
        return translations.findByRevisionIdIn(selected.values().stream().map(SpellRevision::getId).toList())
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(SpellTranslation::getRevisionId));
    }

    private List<SpellIdentity> matchingOwners(Map<UUID, SpellRevision> selected,
            Map<UUID, List<SpellTranslation>> copies, String needle) {
        return identities.findAll(Sort.by("code")).stream().filter(owner -> selected.containsKey(owner.getId()))
                .filter(owner -> needle.isEmpty() || owner.getCode().contains(needle)
                        || copies.getOrDefault(selected.get(owner.getId()).getId(), List.of()).stream()
                                .anyMatch(
                                        translation -> translation.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .toList();
    }

    private PageSlice<SpellView> requestedPage(List<SpellIdentity> owners, Map<UUID, SpellRevision> selected,
            Map<UUID, List<SpellTranslation>> copies, int page, int size) {
        int start = (int) Math.min((long) page * size, owners.size());
        var pageRows = owners.subList(start, Math.min(start + size, owners.size())).stream().map(owner -> {
            var revision = selected.get(owner.getId());
            var copy = copies.getOrDefault(revision.getId(), List.of());
            var c = revisionContent.hydrate(revision, copy);
            return new SpellView(owner.getId(), owner.getCode(), revisionContent.revisionView(owner, revision), c,
                    contentRules.readiness(revision, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }

    SpellView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "No snapshot is available.");
        return found;
    }

    SpellView read(UUID id, UUID revisionId) {
        return revisionContent.view(identity(id), revision(id, revisionId));
    }

    List<SpellView.Revision> history(UUID id) {
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
                    return new MediaUsage("SPELL", "SPELL", revision.getOwnerId(), revision.getId(), "ICON",
                            revision.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }

    PageSlice<SpellView> published(String region, String locale, int page, int size) {
        return published(region, locale, page, size, null, null, false);
    }

    PageSlice<SpellView> published(String region, String locale, int page, int size,
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

    SpellView publishedOne(UUID id, String region, String locale) {
        return publishedOne(id, region, locale, null, null, false);
    }

    SpellView publishedOne(UUID id, String region, String locale,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        var owner = identity(id);
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        return current(id, context)
                .filter(revision -> scope.allowUnscoped() || revision.getEffectiveFromPatchVariantId() != null)
                .map(revision -> revisionContent.publicView(owner, revision, locale))
                .map(publicMedia::hydrate).orElseThrow(
                        () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "No published snapshot is available."));
    }

    Optional<SpellRevision> current(UUID id, GameplayContext context) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(context.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= context.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED))
            return Optional.empty();
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(revision -> revision.getState().equals("PUBLISHED")
                        && (revision.getEffectiveFromPatchVariantId() != null
                                || CatalogObservation.isUnscopedBaseline(revision.getCause(),
                                        revision.getSourceRevisionId(), null)
                                        && !contentRules.archived(revision, revision.getGameplay()))
                        && revision.getRulesetId().equals(context.rulesetId())
                        && patchOrdinal(revision) <= context.rulesetOrdinal())
                .max(Comparator.<SpellRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(revision -> revision.getPublicationSequence() == null
                                ? 0
                                : revision.getPublicationSequence()));
    }

    SpellView latest(SpellIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(revision -> !revision.getState().equals("DISCARDED")
                        && (rulesetId == null || revision.getRulesetId().equals(rulesetId)))
                .max(Comparator.<SpellRevision>comparingLong(this::patchOrdinal)
                        .thenComparingLong(SpellRevision::getRevisionNo))
                .map(revision -> revisionContent.view(owner, revision)).orElse(null);
    }

    SpellIdentity identity(UUID id) {
        return identities.findById(id).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "The catalog entry was not found."));
    }

    SpellRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(revision -> revision.getOwnerId().equals(id)).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_REVISION_NOT_FOUND, "The revision was not found."));
    }

    long patchOrdinal(SpellRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }

    PageSlice<SpellView> archives(String region, String locale, int page, int size) {
        return archives(region, locale, page, size, null, null, false);
    }

    PageSlice<SpellView> archives(String region, String locale, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnscoped) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var scope = CatalogReadScope.resolve(contexts, region, clock.instant(), seasonId, patchVariantId,
                includeUnscoped);
        var context = scope.gameplay();
        if (!scope.allowUnscoped())
            return new PageSlice<>(List.of(), page, size, 0);
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(owner -> revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                        .filter(revision -> revision.getState().equals("PUBLISHED")
                                && revision.getRulesetId().equals(context.rulesetId())
                                && contentRules.archived(revision, revision.getGameplay()))
                        .max(Comparator.comparingLong(revision -> revision.getPublicationSequence()))
                        .map(revision -> revisionContent.publicView(owner, revision, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        int start = (int) Math.min((long) page * size, rows.size());
        return new PageSlice<>(publicMedia.hydrate(rows.subList(start, Math.min(start + size, rows.size()))), page,
                size, rows.size());
    }

    List<SpellRemovalView> removals(UUID id, UUID rulesetId) {
        identity(id);
        contexts.requireRuleset(rulesetId);
        return removals.findBySpellIdAndRulesetIdOrderByRecordedAtDesc(id, rulesetId).stream()
                .map(SpellRemovalView::from).toList();
    }

    List<Map<String, Object>> authoringRemovals(UUID variantId, String locale) {
        contexts.variant(variantId);
        return removalChanges(variantId, locale);
    }

    List<Map<String, Object>> forVariant(UUID variantId, String locale) {
        return contexts.variant(variantId).published() ? removalChanges(variantId, locale) : List.of();
    }

    List<Map<String, Object>> removalChanges(UUID variantId, String locale) {
        return removals.findByPatchVariantIdOrderByRecordedAtDesc(variantId).stream().map(event -> {
            var owner = identity(event.getSpellId());
            var content = revisionContent.content(revision(owner.getId(), event.getRevisionId())).publicCopy(locale);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", event.getId());
            row.put("spellId", owner.getId());
            row.put("code", owner.getCode());
            row.put("name",
                    content.translations().isEmpty() ? owner.getCode() : content.translations().getFirst().name());
            row.put("iconAssetId", content.iconAssetId());
            row.put("domain", "SPELL");
            row.put("changeKind", "REMOVED");
            row.put("revisionId", event.getRevisionId());
            row.put("patchVariantId", variantId);
            row.put("sourceUrl", event.getSourceUrl());
            return row;
        }).toList();
    }
}
