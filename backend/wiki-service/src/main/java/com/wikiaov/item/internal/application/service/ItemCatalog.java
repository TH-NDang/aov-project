package com.wikiaov.item.internal.application.service;
import com.wikiaov.access.AuditEntry;
import com.wikiaov.access.AuditLog;
import com.wikiaov.access.CurrentActor;
import com.wikiaov.item.internal.application.ItemCommands.Create;
import com.wikiaov.item.internal.application.ItemCommands.Fork;
import com.wikiaov.item.internal.application.ItemCommands.Mutation;
import com.wikiaov.item.internal.application.ItemCommands.Update;
import com.wikiaov.item.internal.application.ItemErrorCode;
import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.ItemIdentityRepository;
import com.wikiaov.item.internal.persistence.ItemRecipeLockRepository;
import com.wikiaov.item.internal.persistence.ItemRevisionRepository;
import com.wikiaov.item.internal.persistence.entity.ItemIdentity;
import com.wikiaov.item.internal.persistence.entity.ItemRevision;
import com.wikiaov.media.MediaUsage;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.CatalogText.Translation;
import com.wikiaov.platform.PageSlice;
import java.time.Clock;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ItemCatalog {
    private final PatchDataReviews dataReviews;
    private final ItemIdentityRepository identities;
    private final ItemRevisionRepository revisions;
    private final GameplayContexts contexts;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final ItemRecipeLockRepository recipeLock;
    private final ItemCatalogQueries queries;
    private final ItemRevisionContent revisionContent;
    private final ItemContentRules contentRules;

    public ItemCatalog(PatchDataReviews dataReviews, ItemIdentityRepository identities,
            ItemRevisionRepository revisions, GameplayContexts contexts, CurrentActor actors, AuditLog audit,
            Clock clock, ItemRecipeLockRepository recipeLock, ItemCatalogQueries queries,
            ItemRevisionContent revisionContent, ItemContentRules contentRules) {
        this.dataReviews = dataReviews;
        this.identities = identities;
        this.revisions = revisions;
        this.contexts = contexts;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.recipeLock = recipeLock;
        this.queries = queries;
        this.revisionContent = revisionContent;
        this.contentRules = contentRules;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return queries.list(rulesetId, locale, q, page, size);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        return queries.list(rulesetId, locale, q, page, size, seasonId, patchVariantId, includeUnchanged);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public ItemView latest(UUID id, UUID rulesetId) {
        return queries.latest(id, rulesetId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public ItemView read(UUID id, UUID revisionId) {
        return queries.read(id, revisionId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<ItemView.Revision> history(UUID id) {
        return queries.history(id);
    }

    @PreAuthorize("hasAuthority('item:write')")
    public ItemView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        requireObservationContext(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var owner = createIdentity(input.code());
        var content = input.content() == null
                ? new ItemContent(null, null, null, null, List.of(), "UNKNOWN", List.of(), List.of(),
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        contentRules.validate(content);
        var revision = newDraft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        revisionContent.saveContent(revision, content);
        recordAuditEvent("CREATED", owner, revision, null);
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('item:write')")
    public ItemView fork(UUID id, Fork input) {
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

    @PreAuthorize("hasAuthority('item:write')")
    public ItemView update(UUID id, UUID revisionId, Update input) {
        recipeLock.lockGraph().orElseThrow();
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

        if (input.content().components().stream().anyMatch(c -> c.itemId().equals(id)))
            fail("An item cannot build itself.");
        checkRecipeCycle(id, input.content(), revision.getRulesetId(), new HashSet<>());

        if (revisionContent.content(revision).equals(input.content()) && !contextChanged)
            return revisionContent.view(owner, revision);
        revisionContent.saveContent(revision, input.content());
        advanceVersion(revision);
        recordAuditEvent("DRAFT_UPDATED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('item:publish')")
    public ItemView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lockIdentity(id);
        var revision = requireEditableDraft(id, revisionId, input.expectedVersion());
        requireObservationContext(revision.getRulesetId(), revision.getEffectiveFromPatchVariantId(), true);
        var missing = contentRules.missing(revisionContent.content(revision));
        if (!missing.isEmpty())
            throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        contentRules.validate(revisionContent.content(revision));
        publishRevision(revision);
        recordAuditEvent("PUBLISHED", owner, revision, input.changeNote());
        return revisionContent.view(owner, revision);
    }

    @PreAuthorize("hasAuthority('item:write')")
    public ItemView discard(UUID id, UUID revisionId, Mutation input) {
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
    public PageSlice<ItemView> published(String region, String locale, int page, int size) {
        return queries.published(region, locale, page, size);
    }

    @Transactional(readOnly = true)
    public ItemView publishedOne(UUID id, String region, String locale) {
        return queries.publishedOne(id, region, locale);
    }

    private ItemIdentity lockIdentity(UUID id) {
        return identities.lockById(id)
                .orElseThrow(() -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "The catalog entry was not found."));
    }

    private ItemRevision requireEditableDraft(UUID id, UUID revisionId, long expected) {
        var revision = queries.revision(id, revisionId);
        if (!revision.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (revision.getVersion() != expected)
            throw new ApiException(ItemErrorCode.ITEM_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", revision.getVersion()));
        return revision;
    }

    private ItemRevision newDraft(ItemIdentity owner, UUID ruleset, UUID source, String cause, UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream()
                .anyMatch(revision -> revision.getRulesetId().equals(ruleset) && revision.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var actor = actors.require();
        var revision = new ItemRevision();
        revision.setId(UUID.randomUUID());
        revision.setOwnerId(owner.getId());
        revision.setRulesetId(ruleset);
        revision.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(ItemRevision::getRevisionNo).max().orElse(0) + 1);
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

    private long patchOrdinal(ItemRevision revision) {
        return patchOrdinal(revision.getEffectiveFromPatchVariantId());
    }

    private long patchOrdinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }

    private void advanceVersion(ItemRevision revision) {
        var actor = actors.require();
        revision.setVersion(revision.getVersion() + 1);
        revision.setUpdatedAt(clock.instant());
        revision.setUpdatedByIssuer(actor.issuer());
        revision.setUpdatedBySubject(actor.subject());
    }

    private void recordAuditEvent(String action, ItemIdentity owner, ItemRevision revision, String note) {
        audit.record(new AuditEntry(actors.require(), "ITEM_" + action, "ITEM", owner.getId(), revision.getId(),
                revision.getVersion() == 1 ? null : revision.getVersion() - 1, revision.getVersion(), note, Map.of()));
    }

    private void checkRecipeCycle(UUID owner, ItemContent candidate, UUID ruleset, Set<UUID> visiting) {
        for (var component : candidate.components()) {
            if (component.itemId().equals(owner))
                fail("The recipe would create a cycle.");
            if (!visiting.add(component.itemId()))
                continue;
            var other = queries.latest(queries.identity(component.itemId()), ruleset);
            if (other != null)
                checkRecipeCycle(owner, other.content(), ruleset, visiting);
        }
    }

    private static void fail(String message) {
        throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT, message);
    }

    private static void conflict(String message) {
        throw new ApiException(ItemErrorCode.ITEM_CONFLICT, message);
    }

    private ItemIdentity createIdentity(String code) {
        var actor = actors.require();
        var owner = new ItemIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(code);
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        return owner;
    }

    private void publishRevision(ItemRevision revision) {
        revision.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(revision.getOwnerId()).stream()
                .filter(v -> v.getRulesetId().equals(revision.getRulesetId()))
                .map(ItemRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue).max()
                .orElse(0) + 1);
        revision.setState("PUBLISHED");
        revision.setPublishedAt(clock.instant());
        advanceVersion(revision);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(revision.getCause()))
            dataReviews.markDirty(revision.getEffectiveFromPatchVariantId());
    }
}
