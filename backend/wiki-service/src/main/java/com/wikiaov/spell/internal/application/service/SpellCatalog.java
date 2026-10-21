package com.wikiaov.spell.internal.application.service;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.spell.SpellChangeQueries;
import com.wikiaov.spell.internal.application.SpellCommands.Create;
import com.wikiaov.spell.internal.application.SpellCommands.Fork;
import com.wikiaov.spell.internal.application.SpellCommands.Mutation;
import com.wikiaov.spell.internal.application.SpellCommands.Removal;
import com.wikiaov.spell.internal.application.SpellCommands.Update;
import com.wikiaov.spell.internal.application.SpellErrorCode;
import com.wikiaov.spell.internal.application.response.SpellRemovalView;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.persistence.SpellIdentityRepository;
import com.wikiaov.spell.internal.persistence.SpellPatchChangeRepository;
import com.wikiaov.spell.internal.persistence.SpellRemovalRepository;
import com.wikiaov.spell.internal.persistence.SpellRevisionRepository;
import com.wikiaov.spell.internal.persistence.entity.SpellIdentity;
import com.wikiaov.spell.internal.persistence.entity.SpellRemoval;
import com.wikiaov.spell.internal.persistence.entity.SpellRevision;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class SpellCatalog implements SpellChangeQueries {
    private final PatchDataReviews dataReviews;
    private final SpellPatchChangeRepository patchChanges;
    private final SpellIdentityRepository identities;
    private final SpellRevisionRepository revisions;
    private final SpellRemovalRepository removals;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final SpellCatalogQueries queries;
    private final SpellRevisionContent revisionContent;
    private final SpellContentRules contentRules;

    public SpellCatalog(PatchDataReviews dataReviews, SpellPatchChangeRepository patchChanges,
            SpellIdentityRepository identities, SpellRevisionRepository revisions, SpellRemovalRepository removals,
            GameplayContexts contexts, CurrentActor actors, AuditLog audit, Clock clock, SpellCatalogQueries queries,
            SpellRevisionContent revisionContent, SpellContentRules contentRules) {
        this.dataReviews = dataReviews;
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.removals = removals;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.queries = queries;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return queries.list(rulesetId, locale, q, page, size);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public SpellView latest(UUID id, UUID rulesetId) {
        return queries.latest(id, rulesetId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public SpellView read(UUID id, UUID revisionId) {
        return queries.read(id, revisionId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<SpellView.Revision> history(UUID id) {
        return queries.history(id);
    }

    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        requireObservationContext(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var owner = createIdentity(input.code());
        var content = input.content() == null
                ? new SpellContent(null, null, null, "UNKNOWN", "UNKNOWN", false, 0, null, null, null, List.of(),
                        List.of(),
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        contentRules.validate(content);
        var revision = newDraft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        revisionContent.saveContent(revision, content);
        recordAuditEvent("CREATED", owner, revision, null);
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView fork(UUID id, Fork input) {
        var owner = lockIdentity(id);
        var source = queries.revision(id, input.sourceRevisionId());
        if (!source.getState().equals("PUBLISHED") || !source.getRulesetId().equals(input.rulesetId()))
            fail("The source must be published in the selected ruleset.");
        if (!Set.of("GAME_PATCH", "CONTENT_CORRECTION", "TRANSLATION_UPDATE").contains(input.cause()))
            fail("Invalid revision cause.");
        if (source.getEffectiveFromPatchVariantId() == null && input.cause().equals("GAME_PATCH"))
            fail("An archive without a known patch cannot be used as a gameplay baseline. Record removal evidence separately.");
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

    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView update(UUID id, UUID revisionId, Update input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        contentRules.validate(input.content());
        if (revision.getCause().equals("TRANSLATION_UPDATE")
                && !revision.getGameplay().mechanics().equals(input.content().mechanics()))
            fail("Translation revisions cannot change gameplay fields.");
        boolean contextChanged = input.effectiveFromPatchVariantId() != null
                && !Objects.equals(input.effectiveFromPatchVariantId(), revision.getEffectiveFromPatchVariantId());
        boolean clearContext = Boolean.TRUE.equals(input.clearPatchContext());
        if (clearContext && (input.effectiveFromPatchVariantId() != null || !input.content().legacy()
                || !input.content().availability().equals("REMOVED")))
            fail("Only a removed legacy baseline can clear its patch context.");
        if (contextChanged || clearContext) {
            if (!revision.getCause().equals("DATA_BASELINE") || revision.getSourceRevisionId() != null)
                fail("Only an independent baseline draft can change its observation context.");
            requireObservationContext(revision.getRulesetId(), input.effectiveFromPatchVariantId(), !clearContext);
            revision.setEffectiveFromPatchVariantId(input.effectiveFromPatchVariantId());
        }

        if (revisionContent.content(revision).equals(input.content()) && !contextChanged && !clearContext)
            return revisionContent.view(owner, revision);
        revisionContent.saveContent(revision, input.content());
        advanceVersion(revision);
        recordAuditEvent("DRAFT_UPDATED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('spell:publish')")
    public SpellView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        var content = revisionContent.content(revision);
        requireObservationContext(revision.getRulesetId(), revision.getEffectiveFromPatchVariantId(),
                !contentRules.archived(revision, content));
        var missing = contentRules.readiness(revision, content);
        if (!missing.isEmpty())
            throw new ApiException(SpellErrorCode.SPELL_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        contentRules.validate(revisionContent.content(revision));
        publishRevision(revision);
        recordAuditEvent("PUBLISHED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView discard(UUID id, UUID revisionId, Mutation input) {
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
    public PageSlice<SpellView> published(String region, String locale, int page, int size) {
        return queries.published(region, locale, page, size);
    }

    @Transactional(readOnly = true)
    public SpellView publishedOne(UUID id, String region, String locale) {
        return queries.publishedOne(id, region, locale);
    }

    private SpellIdentity lockIdentity(UUID id) {
        return identities.lockById(id).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "The catalog entry was not found."));
    }

    private SpellRevision requireEditableDraft(UUID id, UUID revisionId, long expected) {
        var revision = queries.revision(id, revisionId);
        if (!revision.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (revision.getVersion() != expected)
            throw new ApiException(SpellErrorCode.SPELL_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", revision.getVersion()));
        return revision;
    }

    private SpellRevision newDraft(SpellIdentity owner, UUID ruleset, UUID source, String cause, UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream()
                .anyMatch(revision -> revision.getRulesetId().equals(ruleset) && revision.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var actor = actors.require();
        var revision = new SpellRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(ruleset);
        revision.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(SpellRevision::getRevisionNo).max().orElse(0) + 1);
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

    private long patchOrdinal(SpellRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    private long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }

    private void advanceVersion(SpellRevision revision) {
        var actor = actors.require();
        revision.setVersion(revision.getVersion() + 1);
        revision.setUpdatedAt(clock.instant());
        revision.setUpdatedByIssuer(actor.issuer());
        revision.setUpdatedBySubject(actor.subject());
    }

    private void recordAuditEvent(String action, SpellIdentity owner, SpellRevision revision, String note) {
        audit.record(new AuditEntry(actors.require(), "SPELL_" + action, "SPELL", owner.getId(), revision.getId(),
                revision.getVersion() == 1 ? null : revision.getVersion() - 1, revision.getVersion(), note, Map.of()));
    }

    @Transactional(readOnly = true)
    public PageSlice<SpellView> archives(String region, String locale, int page, int size) {
        return queries.archives(region, locale, page, size);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<SpellRemovalView> removals(UUID id, UUID rulesetId) {
        return queries.removals(id, rulesetId);
    }

    @PreAuthorize("hasAuthority('spell:publish')")
    public SpellRemovalView recordRemoval(UUID id, Removal input) {
        var owner = lockIdentity(id);
        var snapshot = queries.revision(id, input.revisionId());
        var content = snapshot.getGameplay();
        if (!snapshot.getState().equals("PUBLISHED") || !content.legacy() || !content.availability().equals("REMOVED"))
            fail("Removal evidence requires a published legacy spell marked as removed.");
        requireObservationContext(snapshot.getRulesetId(), input.patchVariantId(), true);
        requireEvidenceUrl(input.sourceUrl());
        if (removals.existsBySpellIdAndPatchVariantId(id, input.patchVariantId())
                || patchChanges.existsByOwnerIdAndPatchVariantId(id, input.patchVariantId()))
            conflict("Removal evidence already exists for this spell and patch.");
        var event = newRemovalEvent(id, snapshot, input);
        removals.saveAndFlush(event);
        dataReviews.markDirty(input.patchVariantId());
        recordAuditEvent("REMOVAL_RECORDED", owner, snapshot, input.sourceUrl());
        return SpellRemovalView.from(event);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> authoringRemovals(UUID variantId, String locale) {
        return queries.authoringRemovals(variantId, locale);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> forVariant(UUID variantId, String locale) {
        return queries.forVariant(variantId, locale);
    }

    private static void fail(String message) {
        throw new ApiException(SpellErrorCode.SPELL_INVALID_CONTENT, message);
    }

    private static void conflict(String message) {
        throw new ApiException(SpellErrorCode.SPELL_CONFLICT, message);
    }

    private SpellIdentity createIdentity(String code) {
        var actor = actors.require();
        var owner = new SpellIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        return owner;
    }

    private void publishRevision(SpellRevision revision) {
        revision.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(revision.getOwnerId()).stream()
                .filter(v -> v.getRulesetId().equals(revision.getRulesetId()))
                .map(SpellRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue).max()
                .orElse(0) + 1);
        revision.setState("PUBLISHED");
        revision.setPublishedAt(clock.instant());
        advanceVersion(revision);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(revision.getCause()))
            dataReviews.markDirty(revision.getEffectiveFromPatchVariantId());
    }

    private void requireEvidenceUrl(String sourceUrl) {
        try {
            var url = java.net.URI.create(sourceUrl);
            if (url.getHost() == null || url.getScheme() == null
                    || !Set.of("http", "https").contains(url.getScheme().toLowerCase(Locale.ROOT))
                    || url.getUserInfo() != null)
                fail("A valid HTTP(S) evidence URL is required.");
        } catch (IllegalArgumentException e) {
            fail("A valid HTTP(S) evidence URL is required.");
        }
    }

    private SpellRemoval newRemovalEvent(UUID id, SpellRevision snapshot, Removal input) {
        var actor = actors.require();
        var event = new SpellRemoval();
        event.setId(UUID.randomUUID());
        event.setSpellId(id);
        event.setRevisionId(snapshot.getId());
        event.setRulesetId(snapshot.getRulesetId());
        event.setPatchVariantId(input.patchVariantId());
        event.setSourceUrl(input.sourceUrl());
        event.setNotes(input.notes());
        event.setRecordedAt(clock.instant());
        event.setRecordedByIssuer(actor.issuer());
        event.setRecordedBySubject(actor.subject());
        return event;
    }
}
