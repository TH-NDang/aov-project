package com.wikiaov.enchantment.internal.change.application;

import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentIdentityRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.EnchantmentTranslationRepository;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentRevision;
import com.wikiaov.enchantment.internal.catalog.persistence.entity.EnchantmentTranslation;
import com.wikiaov.enchantment.internal.change.persistence.EnchantmentPatchChangeRepository;
import com.wikiaov.enchantment.internal.change.persistence.entity.EnchantmentPatchChange;
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
import com.wikiaov.platform.CatalogChanges.Summary;
import com.wikiaov.platform.CatalogLocales;
import com.wikiaov.platform.CatalogText;
import com.wikiaov.platform.RevisionState;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class EnchantmentPatchChanges implements CatalogChangeProvider {
    private final PatchDataReviews dataReviews;
    private final EnchantmentPatchChangeRepository changes;
    private final EnchantmentIdentityRepository identities;
    private final EnchantmentRevisionRepository revisions;
    private final EnchantmentTranslationRepository translations;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;

    public EnchantmentPatchChanges(PatchDataReviews dataReviews, EnchantmentPatchChangeRepository changes,
            EnchantmentIdentityRepository identities,
            EnchantmentRevisionRepository revisions, EnchantmentTranslationRepository translations,
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
        return "ENCHANTMENT";
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

        var byId = new HashMap<UUID, EnchantmentRevision>();
        snapshots.forEach(r -> byId.put(r.getId(), r));
        var names = translations.findByRevisionIdIn(new ArrayList<>(byId.keySet())).stream()
                .collect(Collectors.groupingBy(EnchantmentTranslation::getRevisionId));
        var owners = identities.findAllById(snapshots.stream().map(EnchantmentRevision::getOwnerId).distinct().toList())
                .stream()
                .collect(Collectors.toMap(EnchantmentIdentity::getId, i -> i));
        var result = new ArrayList<Entry>(recordedEntries(facts, byId, names, owners, rulesetId, locale));
        result.addAll(observedEntries(snapshots, facts, patchVariantId, names, owners, rulesetId, locale));
        result.sort(Comparator.comparing(Entry::code).thenComparing(e -> e.patchVariantId().toString()));
        return result;
    }

    /** The changes editors confirmed, each with the name and icon of the snapshot it points at. */
    private List<Entry> recordedEntries(List<EnchantmentPatchChange> facts, Map<UUID, EnchantmentRevision> byId,
            Map<UUID, List<EnchantmentTranslation>> names, Map<UUID, EnchantmentIdentity> owners, UUID rulesetId,
            String locale) {
        var result = new ArrayList<Entry>();
        for (var fact : facts) {
            var r = byId.get(fact.getToRevisionId());
            if (r == null) {
                continue;
            }
            var copy = CatalogText.select(
                    names.getOrDefault(r.getId(), List.of()).stream().map(EnchantmentTranslation::content).toList(),
                    locale);
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
    private List<Entry> observedEntries(List<EnchantmentRevision> snapshots, List<EnchantmentPatchChange> facts,
            UUID patchVariantId,
            Map<UUID, List<EnchantmentTranslation>> names, Map<UUID, EnchantmentIdentity> owners, UUID rulesetId,
            String locale) {
        var result = new ArrayList<Entry>();
        var grouped = new HashMap<String, EnchantmentRevision>();
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
                    names.getOrDefault(r.getId(), List.of()).stream().map(EnchantmentTranslation::content).toList(),
                    locale);
            result.add(new Entry(r.getId(), domain(), owner.getId(), owner.getCode(),
                    copy.isEmpty() ? owner.getCode() : copy.getFirst().name(), r.getIconAssetId(), rulesetId,
                    r.getEffectiveFromPatchVariantId(), r.getSourceRevisionId(), r.getId(),
                    List.of(r.getCause() == CatalogCause.DATA_BASELINE ? Kind.DATA_BASELINE : Kind.UPDATED),
                    null, null, null, false, r.getPublishedAt()));
        }
        return result;
    }

    @Transactional
    @PreAuthorize("hasAuthority('enchantment:publish') and hasAuthority('patch:write')")
    public UUID record(UUID ownerId, CatalogChanges.Record input) {
        var owner = identities.lockById(ownerId).orElseThrow(
                () -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "The catalog entry was not found."));

        if (input.patchVariantId() == null || input.toRevisionId() == null || input.kinds() == null
                || input.kinds().isEmpty()
                || input.kinds().size() > 4 || input.kinds().stream().anyMatch(Objects::isNull)
                || new HashSet<>(input.kinds()).size() != input.kinds().size()) {
            invalid("A patch, published target and unique change kinds are required.");
        }

        var target = revisions.findById(input.toRevisionId()).filter(r -> r.getOwnerId().equals(ownerId))
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT,
                        "The target revision was not found."));
        var patch = contexts.variant(input.patchVariantId());
        boolean removed = input.kinds().contains(Kind.REMOVED);
        if (target.getState() != RevisionState.PUBLISHED || !patch.published()
                || !target.getRulesetId().equals(patch.rulesetId())
                || target.getEffectiveFromPatchVariantId() == null
                || !target.getCause().gameplay()) {
            invalid("Use a published gameplay or baseline snapshot and a published patch in the same ruleset.");
        }
        if (removed) {
            if (input.kinds().size() != 1 || contexts.variant(target.getEffectiveFromPatchVariantId())
                    .rulesetOrdinal() > patch.rulesetOrdinal()) {
                invalid("A removal must reference a snapshot at or before the removal patch.");
            }
        } else if (!input.patchVariantId().equals(target.getEffectiveFromPatchVariantId())) {
            invalid("The target snapshot must belong to the selected patch.");
        }
        if (input.kinds().contains(Kind.DATA_BASELINE) && input.kinds().size() != 1
                || input.kinds().contains(Kind.ADDED) && input.kinds().size() != 1) {
            invalid("Baseline and addition must be recorded separately from balance changes.");
        }
        if (input.kinds().contains(Kind.DATA_BASELINE) && target.getCause() != CatalogCause.DATA_BASELINE) {
            invalid("Only baseline snapshots can be classified as baseline.");
        }
        if (!removed && !input.kinds().contains(Kind.ADDED) && !input.kinds().contains(Kind.DATA_BASELINE)
                && (target.getCause() != CatalogCause.GAME_PATCH || input.fromRevisionId() == null)) {
            invalid("Updates require a gameplay snapshot and a known previous snapshot.");
        }

        requireSource(ownerId, input, target, patch);

        var copy = input.translations() == null ? List.<Summary>of() : input.translations();
        if (copy.isEmpty() || copy.size() > 50) {
            invalid("A localized change summary is required.");
        }
        var locales = new HashSet<String>();
        for (var text : copy) {
            if (text == null || text.locale() == null || !text.locale().matches(CatalogLocales.PATTERN)
                    || !locales.add(text.locale()) || text.text() == null || text.text().isBlank()
                    || text.text().length() > 4000) {
                invalid("Invalid or duplicate summary translations.");
            }
        }
        if (input.sourceUrl() == null || input.sourceUrl().length() > 2048
                || !input.sourceUrl().matches("https?://[^\\s]+")) {
            invalid("An HTTP source URL is required for confirmed game changes.");
        }

        if (changes.existsByOwnerIdAndPatchVariantId(ownerId, input.patchVariantId())) {
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT,
                    "A confirmed change already exists for this entry and patch.");
        }

        return save(ownerId, input, target);
    }

    /** The previous snapshot a change names is an earlier published snapshot of the same entry and ruleset. */
    private void requireSource(UUID ownerId, CatalogChanges.Record input, EnchantmentRevision target,
            PatchVariantReference patch) {
        if (input.fromRevisionId() == null) {
            return;
        }

        var from = revisions.findById(input.fromRevisionId())
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT,
                        "The source revision was not found."));
        if (!from.getOwnerId().equals(ownerId) || !from.getRulesetId().equals(target.getRulesetId())
                || from.getState() != RevisionState.PUBLISHED || from.getEffectiveFromPatchVariantId() == null
                || contexts.variant(from.getEffectiveFromPatchVariantId()).rulesetOrdinal() >= patch
                        .rulesetOrdinal()) {
            invalid("The source must be an earlier published snapshot of the same entry and ruleset.");
        }
    }

    /** Stores the confirmed change, marks the patch data for review and records the audit entry. */
    private UUID save(UUID ownerId, CatalogChanges.Record input, EnchantmentRevision target) {
        var actor = actors.require();
        var fact = new EnchantmentPatchChange();
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
        audit.record(new AuditEntry(actor, "ENCHANTMENT_PATCH_CHANGE_RECORDED", CatalogAggregates.ENCHANTMENT, ownerId,
                target.getId(),
                null, null, null, Map.of("changeSetId", fact.getId())));

        return fact.getId();
    }

    private void invalid(String detail) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT, detail);
    }
}
