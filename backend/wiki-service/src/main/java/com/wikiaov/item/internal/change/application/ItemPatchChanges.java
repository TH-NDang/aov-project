package com.wikiaov.item.internal.change.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.catalog.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.catalog.persistence.ItemTranslationRepository;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemRevision;
import com.wikiaov.item.internal.catalog.persistence.entity.ItemTranslation;
import com.wikiaov.item.internal.change.persistence.ItemPatchChangeRepository;
import com.wikiaov.item.internal.change.persistence.entity.ItemPatchChange;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.patch.PatchVariantReference;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogAggregates;
import com.wikiaov.platform.CatalogCause;
import com.wikiaov.platform.CatalogChangeProvider;
import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CatalogChanges.Entry;
import com.wikiaov.platform.CatalogChanges.Kind;
import com.wikiaov.platform.CatalogObservation;
import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ItemPatchChanges implements CatalogChangeProvider {
    private final PatchDataReviews dataReviews;
    private final ItemPatchChangeRepository changes;
    private final ItemIdentityRepository identities;
    private final ItemRevisionRepository revisions;
    private final ItemTranslationRepository translations;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public ItemPatchChanges(PatchDataReviews dataReviews, ItemPatchChangeRepository changes,
            ItemIdentityRepository identities,
            ItemRevisionRepository revisions, ItemTranslationRepository translations,
            GameplayContexts contexts, CurrentActor actors, AuditLog audit, Clock clock) {
        this.dataReviews = dataReviews;
        this.changes = changes;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }

    @Override
    public String domain() {
        return "ITEM";
    }

    @Override
    public List<Entry> changes(UUID rulesetId, UUID patchVariantId, String locale) {
        contexts.requireRuleset(rulesetId);
        var facts = patchVariantId == null
                ? changes.findByRulesetId(rulesetId)
                : changes.findByRulesetIdAndPatchVariantId(rulesetId, patchVariantId);
        var snapshots = patchVariantId == null
                ? revisions.findByRulesetIdAndState(rulesetId, RevisionState.PUBLISHED)
                : revisions.publishedForChanges(rulesetId, patchVariantId);
        if (snapshots.isEmpty()) {
            return List.of();
        }

        var byId = new HashMap<UUID, ItemRevision>();
        snapshots.forEach(r -> byId.put(r.getId(), r));
        var names = translations.findByRevisionIdIn(new ArrayList<>(byId.keySet())).stream()
                .collect(Collectors.groupingBy(ItemTranslation::getRevisionId));
        var owners = identities.findAllById(snapshots.stream().map(ItemRevision::getOwnerId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(ItemIdentity::getId, i -> i));
        var result = new ArrayList<Entry>(recordedEntries(facts, byId, names, owners, rulesetId, locale));
        result.addAll(observedEntries(snapshots, facts, patchVariantId, names, owners, rulesetId, locale));
        result.sort(Comparator.comparing(Entry::code).thenComparing(e -> e.patchVariantId().toString()));
        return result;
    }

    /** The changes editors confirmed, each with the name and icon of the snapshot it points at. */
    private List<Entry> recordedEntries(List<ItemPatchChange> facts, Map<UUID, ItemRevision> byId,
            Map<UUID, List<ItemTranslation>> names, Map<UUID, ItemIdentity> owners, UUID rulesetId, String locale) {
        var result = new ArrayList<Entry>();
        for (var fact : facts) {
            var r = byId.get(fact.getToRevisionId());
            if (r == null) {
                continue;
            }
            var copy = CatalogText.select(
                    names.getOrDefault(r.getId(), List.of()).stream().map(ItemTranslation::content).toList(), locale);
            var summary = CatalogChanges.summary(fact.getTranslations(), locale);
            var owner = owners.get(r.getOwnerId());
            result.add(new Entry(fact.getId(), domain(), owner.getId(), owner.getCode(),
                    copy.isEmpty() ? owner.getCode() : copy.getFirst().name(), r.getIconAssetId(), rulesetId,
                    fact.getPatchVariantId(), fact.getFromRevisionId(), r.getId(), fact.getKinds(),
                    summary == null ? null : summary.text(), summary == null ? null : summary.locale(),
                    fact.getSourceUrl(), true, fact.getRecordedAt()));
        }
        return result;
    }

    /**
     * The published baselines and gameplay snapshots of a patch that no confirmed change covers, newest revision per
     * entry and patch, listed as unconfirmed observations.
     */
    private List<Entry> observedEntries(List<ItemRevision> snapshots, List<ItemPatchChange> facts, UUID patchVariantId,
            Map<UUID, List<ItemTranslation>> names, Map<UUID, ItemIdentity> owners, UUID rulesetId, String locale) {
        var result = new ArrayList<Entry>();
        var grouped = new HashMap<String, ItemRevision>();
        for (var r : snapshots) {
            if (r.getEffectiveFromPatchVariantId() == null
                    || (patchVariantId != null && !patchVariantId.equals(r.getEffectiveFromPatchVariantId()))
                    || !r.getCause().gameplay()) {
                continue;
            }
            if (facts.stream().anyMatch(f -> f.getOwnerId().equals(r.getOwnerId())
                    && f.getPatchVariantId().equals(r.getEffectiveFromPatchVariantId()))) {
                continue;
            }
            String key = r.getOwnerId() + "/" + r.getEffectiveFromPatchVariantId();
            grouped.merge(key, r, (a, b) -> a.getRevisionNo() > b.getRevisionNo() ? a : b);
        }
        for (var r : grouped.values()) {
            var owner = owners.get(r.getOwnerId());
            var copy = CatalogText.select(
                    names.getOrDefault(r.getId(), List.of()).stream().map(ItemTranslation::content).toList(), locale);
            result.add(new Entry(r.getId(), domain(), owner.getId(), owner.getCode(),
                    copy.isEmpty() ? owner.getCode() : copy.getFirst().name(), r.getIconAssetId(), rulesetId,
                    r.getEffectiveFromPatchVariantId(), r.getSourceRevisionId(), r.getId(),
                    List.of(r.getCause() == CatalogCause.DATA_BASELINE ? Kind.DATA_BASELINE : Kind.UPDATED),
                    null, null, null, false, r.getPublishedAt()));
        }
        return result;
    }

    @Transactional
    @PreAuthorize("hasAuthority('item:publish') and hasAuthority('patch:write')")
    public UUID record(UUID ownerId, CatalogChanges.Record input) {
        var owner = identities.lockById(ownerId)
                .orElseThrow(() -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "The catalog entry was not found."));

        reject(CatalogChanges.requestProblem(input));

        var target = revisions.findById(input.toRevisionId()).filter(r -> r.getOwnerId().equals(ownerId)).orElseThrow(
                () -> new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, "The target revision was not found."));
        var patch = contexts.variant(input.patchVariantId());
        boolean removed = input.kinds().contains(Kind.REMOVED);
        if (target.getState() != RevisionState.PUBLISHED || !patch.published()
                || !target.getRulesetId().equals(patch.rulesetId())
                || target.getEffectiveFromPatchVariantId() == null
                        && !(removed && CatalogObservation.isUnscopedBaseline(
                                target.getCause(), target.getSourceRevisionId(), null))
                || !target.getCause().gameplay()) {
            invalid("Use a published gameplay or baseline snapshot and a published patch in the same ruleset.");
        }
        if (removed) {
            long targetOrdinal = GameplayContexts.rulesetOrdinal(contexts, target.getEffectiveFromPatchVariantId());
            if (input.kinds().size() != 1 || targetOrdinal > patch.rulesetOrdinal()) {
                invalid("A removal must reference a snapshot at or before the removal patch.");
            }
        } else if (!input.patchVariantId().equals(target.getEffectiveFromPatchVariantId())) {
            invalid("The target snapshot must belong to the selected patch.");
        }
        reject(CatalogChanges.kindsProblem(input, target.getCause(), removed));

        requireSource(ownerId, input, target, patch);

        reject(CatalogChanges.evidenceProblem(input));

        if (changes.existsByOwnerIdAndPatchVariantId(ownerId, input.patchVariantId())) {
            throw new ApiException(ItemErrorCode.ITEM_CONFLICT,
                    "A confirmed change already exists for this entry and patch.");
        }

        return save(ownerId, input, target);
    }

    /** The previous snapshot a change names is an earlier published snapshot of the same entry and ruleset. */
    private void requireSource(UUID ownerId, CatalogChanges.Record input, ItemRevision target,
            PatchVariantReference patch) {
        if (input.fromRevisionId() == null) {
            return;
        }

        var from = revisions.findById(input.fromRevisionId()).orElseThrow(
                () -> new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, "The source revision was not found."));
        if (!from.getOwnerId().equals(ownerId) || !from.getRulesetId().equals(target.getRulesetId())
                || from.getState() != RevisionState.PUBLISHED
                || from.getEffectiveFromPatchVariantId() == null && !CatalogObservation.isUnscopedBaseline(
                        from.getCause(), from.getSourceRevisionId(), null)
                || (GameplayContexts.rulesetOrdinal(contexts, from.getEffectiveFromPatchVariantId())) >= patch
                        .rulesetOrdinal()) {
            invalid("The source must be an earlier published snapshot of the same entry and ruleset.");
        }
    }

    /** Stores the confirmed change, marks the patch data for review and records the audit entry. */
    private UUID save(UUID ownerId, CatalogChanges.Record input, ItemRevision target) {
        var actor = actors.require();
        var fact = new ItemPatchChange();
        fact.setId(UUID.randomUUID());
        fact.setOwnerId(ownerId);
        fact.setRulesetId(target.getRulesetId());
        fact.setPatchVariantId(input.patchVariantId());
        fact.setFromRevisionId(input.fromRevisionId());
        fact.setToRevisionId(target.getId());
        fact.setKinds(List.copyOf(input.kinds()));
        fact.setTranslations(List.copyOf(input.translations()));
        fact.setSourceUrl(input.sourceUrl());
        fact.setRecordedAt(clock.instant());
        fact.setRecordedByIssuer(actor.issuer());
        fact.setRecordedBySubject(actor.subject());
        changes.saveAndFlush(fact);
        dataReviews.markDirty(input.patchVariantId());
        audit.record(new AuditEntry(actor, "ITEM_PATCH_CHANGE_RECORDED", CatalogAggregates.ITEM, ownerId,
                target.getId(), null, null,
                null, Map.of("changeSetId", fact.getId())));

        return fact.getId();
    }

    /** Answers a broken shared change rule (ADR-031) with this catalog's invalid-content error. */
    private void reject(@Nullable String problem) {
        if (problem != null) {
            invalid(problem);
        }
    }

    private void invalid(String detail) {
        throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, detail);
    }
}
