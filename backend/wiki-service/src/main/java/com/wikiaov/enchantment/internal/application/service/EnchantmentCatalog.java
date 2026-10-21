package com.wikiaov.enchantment.internal.application.service;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Create;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Fork;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Mutation;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Update;
import com.wikiaov.enchantment.internal.application.EnchantmentErrorCode;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.persistence.EnchantmentBranchRepository;
import com.wikiaov.enchantment.internal.persistence.EnchantmentIdentityRepository;
import com.wikiaov.enchantment.internal.persistence.EnchantmentRevisionRepository;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentIdentity;
import com.wikiaov.enchantment.internal.persistence.entity.EnchantmentRevision;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class EnchantmentCatalog {
    private final PatchDataReviews dataReviews;
    private final EnchantmentIdentityRepository identities;
    private final EnchantmentRevisionRepository revisions;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final EnchantmentBranchRepository metadata;
    private final EnchantmentCatalogQueries queries;
    private final EnchantmentRevisionContent revisionContent;
    private final EnchantmentContentRules contentRules;

    public EnchantmentCatalog(PatchDataReviews dataReviews, EnchantmentIdentityRepository identities,
            EnchantmentRevisionRepository revisions, GameplayContexts contexts, CurrentActor actors, AuditLog audit,
            Clock clock, EnchantmentBranchRepository metadata, EnchantmentCatalogQueries queries,
            EnchantmentRevisionContent revisionContent, EnchantmentContentRules contentRules) {
        this.dataReviews = dataReviews;
        this.identities = identities;
        this.revisions = revisions;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.metadata = metadata;
        this.queries = queries;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return queries.list(rulesetId, locale, q, page, size);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public EnchantmentView latest(UUID id, UUID rulesetId) {
        return queries.latest(id, rulesetId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public EnchantmentView read(UUID id, UUID revisionId) {
        return queries.read(id, revisionId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<EnchantmentView.Revision> history(UUID id) {
        return queries.history(id);
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        requireObservationContext(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var owner = createIdentity(input.code());
        var content = input.content() == null
                ? new EnchantmentContent(null, null, null, null,
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        contentRules.validate(content);
        var revision = newDraft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        revisionContent.saveContent(revision, content);
        recordAuditEvent("CREATED", owner, revision, null);
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView fork(UUID id, Fork input) {
        var owner = lockIdentity(id);
        var source = queries.revision(id, input.sourceRevisionId());
        if (!source.getState().equals("PUBLISHED") || !source.getRulesetId().equals(input.rulesetId()))
            fail("The source must be published in the selected ruleset.");
        if (!Set.of("GAME_PATCH", "CONTENT_CORRECTION", "TRANSLATION_UPDATE").contains(input.cause()))
            fail("Invalid revision cause.");
        UUID effective = input.effectiveFromPatchVariantId() == null
                ? source.getEffectiveFromPatchVariantId()
                : input.effectiveFromPatchVariantId();
        requireObservationContext(input.rulesetId(), effective, false);
        if (patchOrdinal(source) > patchOrdinal(effective))
            fail("A future snapshot cannot reconstruct an earlier patch.");
        if (!input.cause().equals("GAME_PATCH") && !Objects.equals(effective, source.getEffectiveFromPatchVariantId()))
            fail("Content corrections retain source gameplay applicability.");
        var revision = newDraft(owner, input.rulesetId(), source.getId(), input.cause(), effective);
        revisionContent.saveContent(revision, revisionContent.content(source));
        recordAuditEvent("DRAFT_CREATED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView update(UUID id, UUID revisionId, Update input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        contentRules.validate(input.content());
        if (revision.getCause().equals("TRANSLATION_UPDATE")
                && !revision.getGameplay().mechanics().equals(input.content().mechanics()))
            fail("Translation revisions cannot change gameplay fields.");
        boolean contextChanged = input.effectiveFromPatchVariantId() != null
                && !Objects.equals(input.effectiveFromPatchVariantId(), revision.getEffectiveFromPatchVariantId());
        if (contextChanged) {
            if (!revision.getCause().equals("DATA_BASELINE") || revision.getSourceRevisionId() != null)
                fail("Only an independent baseline draft can change its observation context.");
            requireObservationContext(revision.getRulesetId(), input.effectiveFromPatchVariantId(), true);
            revision.setEffectiveFromPatchVariantId(input.effectiveFromPatchVariantId());
        }

        if (revisionContent.content(revision).equals(input.content()) && !contextChanged)
            return revisionContent.view(owner, revision);
        revisionContent.saveContent(revision, input.content());
        advanceVersion(revision);
        recordAuditEvent("DRAFT_UPDATED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('enchantment:publish')")
    public EnchantmentView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        requireObservationContext(revision.getRulesetId(), revision.getEffectiveFromPatchVariantId(), true);
        var missing = contentRules.missing(revisionContent.content(revision));
        if (!missing.isEmpty())
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        contentRules.validate(revisionContent.content(revision));
        publishRevision(revision);
        recordAuditEvent("PUBLISHED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public List<EnchantmentView> reorder(EnchantmentOrdering.Nodes input) {
        var owners = lockReorderMembers(input);
        requireCompleteTierMembership(input, owners.keySet());
        var ordered = requireReorderableDrafts(input, owners);
        applyPositions(ordered, owners);
        return ordered.stream().map(revision -> revisionContent.view(owners.get(revision.getOwnerId()), revision))
                .toList();
    }

    private Map<UUID, EnchantmentIdentity> lockReorderMembers(EnchantmentOrdering.Nodes input) {
        if (metadata.lockByCode(input.branchCode()).isEmpty())
            fail("Unknown enchantment branch.");
        var ids = input.entries().stream().map(EnchantmentOrdering.Node::id).toList();
        if (new HashSet<>(ids).size() != ids.size())
            fail("Duplicate enchantment identities are not allowed.");
        var owners = new HashMap<UUID, EnchantmentIdentity>();
        ids.stream().sorted().forEach(id -> owners.put(id, lockIdentity(id)));
        return owners;
    }

    private void requireCompleteTierMembership(EnchantmentOrdering.Nodes input, Set<UUID> ids) {
        var peers = new HashSet<UUID>();
        for (int page = 0;; page++) {
            var slice = list(input.rulesetId(), "vi-VN", "", page, 100);
            for (var entry : slice.items())
                if (input.branchCode().equals(entry.content().branchCode())
                        && Objects.equals(input.tier(), entry.content().tier()))
                    peers.add(entry.id());
            if ((long) (page + 1) * 100 >= slice.totalElements())
                break;
        }
        if (!peers.equals(new HashSet<>(ids)))
            conflict("The tier membership has changed. Reload before reordering.");
    }

    private List<EnchantmentRevision> requireReorderableDrafts(EnchantmentOrdering.Nodes input,
            Map<UUID, EnchantmentIdentity> owners) {
        var ordered = new ArrayList<EnchantmentRevision>();
        for (var entry : input.entries()) {
            var revision = requireEditableDraft(entry.id(), entry.revisionId(), entry.expectedVersion());
            var g = revision.getGameplay();
            var latest = queries.latest(owners.get(entry.id()), input.rulesetId());
            if (!revision.getRulesetId().equals(input.rulesetId()) || !input.branchCode().equals(g.branchCode())
                    || !Objects.equals(input.tier(), g.tier()) || latest == null
                    || !latest.revision().id().equals(revision.getId()))
                conflict("Only the current drafts in the selected branch and tier can be reordered.");
            if (revision.getCause().equals("TRANSLATION_UPDATE"))
                fail("Translation revisions cannot change gameplay fields.");
            ordered.add(revision);
        }
        return ordered;
    }

    private void applyPositions(List<EnchantmentRevision> ordered, Map<UUID, EnchantmentIdentity> owners) {
        for (int index = 0; index < ordered.size(); index++) {
            var revision = ordered.get(index);
            var g = revision.getGameplay();
            if (Objects.equals(index, g.position()))
                continue;
            revision.setGameplay(new EnchantmentContent(g.iconAssetId(), g.branchCode(), g.tier(), index,
                    List.of(), g.notes()));
            advanceVersion(revision);
            revisions.saveAndFlush(revision);
            recordAuditEvent("REORDERED", owners.get(revision.getOwnerId()), revision,
                    "Reorder enchantments within the same tier.");
        }
    }

    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView discard(UUID id, UUID revisionId, Mutation input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        revision.setState("DISCARDED");
        advanceVersion(revision);
        recordAuditEvent("DRAFT_DISCARDED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    public List<MediaUsage> usages(UUID assetId) {
        return queries.usages(assetId);
    }

    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> published(String region, String locale, int page, int size) {
        return queries.published(region, locale, page, size);
    }

    @Transactional(readOnly = true)
    public EnchantmentView publishedOne(UUID id, String region, String locale) {
        return queries.publishedOne(id, region, locale);
    }

    private EnchantmentIdentity lockIdentity(UUID id) {
        return identities.lockById(id).orElseThrow(
                () -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "The catalog entry was not found."));
    }

    private EnchantmentRevision requireEditableDraft(UUID id, UUID revisionId, long expected) {
        var revision = queries.revision(id, revisionId);
        if (!revision.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (revision.getVersion() != expected)
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", revision.getVersion()));
        return revision;
    }

    private EnchantmentRevision newDraft(EnchantmentIdentity owner, UUID ruleset, UUID source, String cause,
            UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream()
                .anyMatch(revision -> revision.getRulesetId().equals(ruleset) && revision.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var actor = actors.require();
        var revision = new EnchantmentRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(ruleset);
        revision.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(EnchantmentRevision::getRevisionNo).max().orElse(0) + 1);
        revision.setState("DRAFT");
        revision.setVersion(1);
        revision.setCause(cause);
        revision.setSourceRevisionId(source);
        revision.setEffectiveFromPatchVariantId(effective);
        revision.setCreatedAt(clock.instant());
        revision.setUpdatedAt(clock.instant());
        revision.setCreatedByIssuer(actor.issuer());
        revision.setCreatedBySubject(actor.subject());
        revision.setUpdatedByIssuer(actor.issuer());
        revision.setUpdatedBySubject(actor.subject());
        return revision;
    }

    private void requireObservationContext(UUID ruleset, UUID effective, boolean publication) {
        contexts.requireRuleset(ruleset);
        if (effective == null) {
            if (publication)
                fail("A patch observation context is required before publication.");
            return;
        }
        var variant = contexts.variant(effective);
        if (!variant.rulesetId().equals(ruleset) || publication && !variant.published())
            fail("The patch must belong to the ruleset and be published first.");
    }

    private long patchOrdinal(EnchantmentRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    private long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }

    private void advanceVersion(EnchantmentRevision revision) {
        var actor = actors.require();
        revision.setVersion(revision.getVersion() + 1);
        revision.setUpdatedAt(clock.instant());
        revision.setUpdatedByIssuer(actor.issuer());
        revision.setUpdatedBySubject(actor.subject());
    }

    private void recordAuditEvent(String action, EnchantmentIdentity owner, EnchantmentRevision revision, String note) {
        audit.record(new AuditEntry(actors.require(), "ENCHANTMENT_" + action, "ENCHANTMENT", owner.getId(),
                revision.getId(),
                revision.getVersion() == 1 ? null : revision.getVersion() - 1, revision.getVersion(), note, Map.of()));
    }

    private static void fail(String message) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT, message);
    }

    private static void conflict(String message) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, message);
    }

    private EnchantmentIdentity createIdentity(String code) {
        var actor = actors.require();
        var owner = new EnchantmentIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        return owner;
    }

    private void publishRevision(EnchantmentRevision revision) {
        revision.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(revision.getOwnerId()).stream()
                .filter(v -> v.getRulesetId().equals(revision.getRulesetId()))
                .map(EnchantmentRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue)
                .max().orElse(0) + 1);
        revision.setState("PUBLISHED");
        revision.setPublishedAt(clock.instant());
        advanceVersion(revision);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(revision.getCause()))
            dataReviews.markDirty(revision.getEffectiveFromPatchVariantId());
    }
}
