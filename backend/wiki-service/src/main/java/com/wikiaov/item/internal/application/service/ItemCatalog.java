package com.wikiaov.item.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.item.internal.application.*;
import com.wikiaov.item.internal.application.ItemCommands.*;
import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.item.internal.domain.ItemContent;
import com.wikiaov.item.internal.persistence.*;
import com.wikiaov.item.internal.persistence.entity.*;
import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import com.wikiaov.platform.*;
import com.wikiaov.platform.CatalogText.*;
import java.time.Clock;
import java.util.*;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class ItemCatalog {
    private final PatchDataReviews dataReviews;
    private final ItemPatchChangeRepository patchChanges;
    private final ItemIdentityRepository identities;
    private final ItemRevisionRepository revisions;
    private final ItemTranslationRepository translations;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final ItemCategoryRepository metadata;
    private final ItemRecipeLockRepository recipeLock;
    public ItemCatalog(PatchDataReviews dataReviews, ItemPatchChangeRepository patchChanges,
            ItemIdentityRepository identities,
            ItemRevisionRepository revisions,
            ItemTranslationRepository translations,
            GameplayContexts contexts, MediaAssets media, CurrentActor actors, AuditLog audit, Clock clock,
            ItemCategoryRepository metadata, ItemRecipeLockRepository recipeLock) {
        this.dataReviews = dataReviews;
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.contexts = contexts;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
        this.metadata = metadata;
        this.recipeLock = recipeLock;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<ItemView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        if (rulesetId != null)
            contexts.requireRuleset(rulesetId);
        String needle = q.strip().toLowerCase(Locale.ROOT);
        var candidates = revisions.findByStateNot("DISCARDED").stream()
                .filter(r -> rulesetId == null || r.getRulesetId().equals(rulesetId))
                .map(r -> new CatalogSnapshots.Snapshot<>(r.getId(), r.getOwnerId(),
                        r.getEffectiveFromPatchVariantId(), r.getRevisionNo(), r.getState(), r.getCause(), r))
                .toList();
        if (seasonId != null || patchVariantId != null) {
            var scope = CatalogPatchScope.resolve(contexts, rulesetId, seasonId, patchVariantId, includeUnchanged);
            var allowed = scope.selectedPatchIds();
            if (includeUnchanged) {
                var applicable = scope.applicablePatchIds();
                var changes = patchChanges.findAll().stream()
                        .map(f -> new CatalogSnapshots.Change(f.getOwnerId(), f.getPatchVariantId(),
                                f.getKinds().contains(CatalogChanges.Kind.REMOVED)))
                        .toList();
                candidates = CatalogSnapshots.carriedForward(candidates, allowed, applicable, changes, this::ordinal);
            } else {
                var explicitTargets = patchChanges.findAll().stream()
                        .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                                && allowed.contains(f.getPatchVariantId()))
                        .map(f -> f.getToRevisionId()).collect(java.util.stream.Collectors.toSet());
                candidates = CatalogSnapshots.changedAt(candidates, allowed, explicitTargets);
            }
        }
        var selected = CatalogSnapshots.latestByOwner(candidates, this::ordinal);
        var copies = translations.findByRevisionIdIn(selected.values().stream().map(ItemRevision::getId).toList())
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(ItemTranslation::getRevisionId));
        var owners = identities.findAll(Sort.by("code")).stream().filter(i -> selected.containsKey(i.getId()))
                .filter(i -> needle.isEmpty() || i.getCode().contains(needle)
                        || copies.getOrDefault(selected.get(i.getId()).getId(), List.of()).stream()
                                .anyMatch(t -> t.getName().toLowerCase(Locale.ROOT).contains(needle)))
                .toList();
        int start = (int) Math.min((long) page * size, owners.size());
        var pageRows = owners.subList(start, Math.min(start + size, owners.size())).stream().map(i -> {
            var r = selected.get(i.getId());
            var copy = copies.getOrDefault(r.getId(), List.of());
            var c = hydrate(r, copy);
            return new ItemView(i.getId(), i.getCode(), revisionView(i, r), c, readiness(r, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public ItemView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "No snapshot is available.");
        return found;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public ItemView read(UUID id, UUID revisionId) {
        return view(identity(id), revision(id, revisionId));
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<ItemView.Revision> history(UUID id) {
        var owner = identity(id);
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().map(r -> revisionView(owner, r)).toList();
    }
    @PreAuthorize("hasAuthority('item:write')")
    public ItemView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        context(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var actor = actors.require();
        var owner = new ItemIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(input.code());
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        var content = input.content() == null
                ? new ItemContent(null, null, null, null, List.of(), "UNKNOWN", List.of(), List.of(),
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        validate(content);
        var r = draft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        saveContent(r, content);
        record("CREATED", owner, r, null);
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('item:write')")
    public ItemView fork(UUID id, Fork input) {
        var owner = lock(id);
        var source = revision(id, input.sourceRevisionId());
        if (!source.getState().equals("PUBLISHED") || !source.getRulesetId().equals(input.rulesetId()))
            fail("The source must be published in the selected ruleset.");
        if (!Set.of("GAME_PATCH", "CONTENT_CORRECTION", "TRANSLATION_UPDATE").contains(input.cause()))
            fail("Invalid revision cause.");
        UUID effective = input.effectiveFromPatchVariantId() == null
                ? source.getEffectiveFromPatchVariantId()
                : input.effectiveFromPatchVariantId();
        context(input.rulesetId(), effective, false);
        if (ordinal(source) > ordinal(effective))
            fail("A future snapshot cannot reconstruct an earlier patch.");
        if (!input.cause().equals("GAME_PATCH") && !Objects.equals(effective, source.getEffectiveFromPatchVariantId()))
            fail("Content corrections retain source gameplay applicability.");
        var r = draft(owner, input.rulesetId(), source.getId(), input.cause(), effective);
        saveContent(r, content(source));
        record("DRAFT_CREATED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('item:write')")
    public ItemView update(UUID id, UUID revisionId, Update input) {
        recipeLock.lockGraph().orElseThrow();
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        validate(input.content());
        if (r.getCause().equals("TRANSLATION_UPDATE")
                && !r.getGameplay().mechanics().equals(input.content().mechanics()))
            fail("Translation revisions cannot change gameplay fields.");
        boolean contextChanged = input.effectiveFromPatchVariantId() != null
                && !Objects.equals(input.effectiveFromPatchVariantId(), r.getEffectiveFromPatchVariantId());
        if (contextChanged) {
            if (!r.getCause().equals("DATA_BASELINE") || r.getSourceRevisionId() != null)
                fail("Only an independent baseline draft can change its observation context.");
            context(r.getRulesetId(), input.effectiveFromPatchVariantId(), true);
            r.setEffectiveFromPatchVariantId(input.effectiveFromPatchVariantId());
        }

        if (input.content().components().stream().anyMatch(c -> c.itemId().equals(id)))
            fail("An item cannot build itself.");
        checkRecipeCycle(id, input.content(), r.getRulesetId(), new HashSet<>());

        if (content(r).equals(input.content()) && !contextChanged)
            return view(owner, r);
        saveContent(r, input.content());
        bump(r);
        record("DRAFT_UPDATED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('item:publish')")
    public ItemView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        context(r.getRulesetId(), r.getEffectiveFromPatchVariantId(), true);
        var missing = missing(content(r));
        if (!missing.isEmpty())
            throw new ApiException(ItemErrorCode.ITEM_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        validate(content(r));
        r.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(v -> v.getRulesetId().equals(r.getRulesetId()))
                .map(ItemRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue).max()
                .orElse(0) + 1);
        r.setState("PUBLISHED");
        r.setPublishedAt(clock.instant());
        bump(r);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(r.getCause()))
            dataReviews.markDirty(r.getEffectiveFromPatchVariantId());
        record("PUBLISHED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('item:write')")
    public ItemView discard(UUID id, UUID revisionId, Mutation input) {
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        r.setState("DISCARDED");
        bump(r);
        record("DRAFT_DISCARDED", owner, r, input.changeNote());
        return view(owner, r);
    }
    public List<MediaUsage> usages(UUID assetId) {
        var active = contexts.active(clock.instant());
        return revisions.findAll().stream()
                .filter(r -> !r.getState().equals("DISCARDED") && assets(r.getGameplay()).contains(assetId)).map(r -> {
                    boolean current = active.stream().filter(c -> c.rulesetId().equals(r.getRulesetId()))
                            .anyMatch(c -> current(r.getOwnerId(), c).map(v -> v.getId().equals(r.getId()))
                                    .orElse(false));
                    return new MediaUsage("ITEM", "ITEM", r.getOwnerId(), r.getId(), "ICON",
                            r.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }
    @Transactional(readOnly = true)
    public PageSlice<ItemView> published(String region, String locale, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var ctx = contexts.resolve(region, clock.instant());
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(i -> current(i.getId(), ctx).map(r -> publicView(i, r, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        int start = (int) Math.min((long) page * size, rows.size());
        return new PageSlice<>(rows.subList(start, Math.min(start + size, rows.size())), page, size, rows.size());
    }
    @Transactional(readOnly = true)
    public ItemView publishedOne(UUID id, String region, String locale) {
        var owner = identity(id);
        var ctx = contexts.resolve(region, clock.instant());
        return current(id, ctx).map(r -> publicView(owner, r, locale)).orElseThrow(
                () -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "No published snapshot is available."));
    }
    private Optional<ItemRevision> current(UUID id, GameplayContext ctx) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(ctx.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= ctx.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED))
            return Optional.empty();
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().filter(r -> r.getState().equals("PUBLISHED")
                && r.getRulesetId().equals(ctx.rulesetId()) && ordinal(r) <= ctx.rulesetOrdinal())
                .max(Comparator.<ItemRevision>comparingLong(this::ordinal)
                        .thenComparingLong(r -> r.getPublicationSequence() == null ? 0 : r.getPublicationSequence()));
    }
    private ItemView latest(ItemIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(r -> !r.getState().equals("DISCARDED")
                        && (rulesetId == null || r.getRulesetId().equals(rulesetId)))
                .max(Comparator.<ItemRevision>comparingLong(this::ordinal)
                        .thenComparingLong(ItemRevision::getRevisionNo))
                .map(r -> view(owner, r)).orElse(null);
    }
    private ItemIdentity identity(UUID id) {
        return identities.findById(id)
                .orElseThrow(() -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "The catalog entry was not found."));
    }
    private ItemIdentity lock(UUID id) {
        return identities.lockById(id)
                .orElseThrow(() -> new ApiException(ItemErrorCode.ITEM_NOT_FOUND, "The catalog entry was not found."));
    }
    private ItemRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(r -> r.getOwnerId().equals(id)).orElseThrow(
                () -> new ApiException(ItemErrorCode.ITEM_REVISION_NOT_FOUND, "The revision was not found."));
    }
    private ItemRevision editable(UUID id, UUID revisionId, long expected) {
        var r = revision(id, revisionId);
        if (!r.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (r.getVersion() != expected)
            throw new ApiException(ItemErrorCode.ITEM_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", r.getVersion()));
        return r;
    }
    private ItemRevision draft(ItemIdentity owner, UUID ruleset, UUID source, String cause, UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream().anyMatch(r -> r.getRulesetId().equals(ruleset) && r.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var a = actors.require();
        var r = new ItemRevision();
        r.setId(UUID.randomUUID());
        r.setOwnerId(owner.getId());
        r.setRulesetId(ruleset);
        r.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(ItemRevision::getRevisionNo).max().orElse(0) + 1);
        r.setState("DRAFT");
        r.setVersion(1);
        r.setCause(cause);
        r.setSourceRevisionId(source);
        r.setEffectiveFromPatchVariantId(effective);
        r.setCreatedAt(clock.instant());
        r.setUpdatedAt(clock.instant());
        r.setCreatedByIssuer(a.issuer());
        r.setCreatedBySubject(a.subject());
        r.setUpdatedByIssuer(a.issuer());
        r.setUpdatedBySubject(a.subject());
        return r;
    }
    private void saveContent(ItemRevision r, ItemContent content) {
        r.setGameplay(content.withTranslations(List.of()));
        r.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(r);
        translations.deleteByRevisionId(r.getId());
        translations.flush();
        for (var t : content.translations()) {
            var row = new ItemTranslation();
            row.setId(UUID.randomUUID());
            row.setRevisionId(r.getId());
            row.setLocale(t.locale());
            row.setName(t.name());
            row.setSummary(t.summary());
            row.setDescription(t.description());
            row.setStatLabels(t.statLabels());
            row.setEffects(t.effects());
            row.setVariantLabels(t.variantLabels());
            translations.save(row);
        }
        translations.flush();
    }
    private ItemContent content(ItemRevision r) {
        return r.getGameplay().withTranslations(
                translations.findByRevisionIdOrderByLocale(r.getId()).stream().map(ItemTranslation::content).toList());
    }
    private ItemContent hydrate(ItemRevision r, List<ItemTranslation> copy) {
        return r.getGameplay().withTranslations(copy.stream().map(ItemTranslation::content).toList());
    }
    private ItemView publicView(ItemIdentity owner, ItemRevision r, String locale) {
        return new ItemView(owner.getId(), owner.getCode(), revisionView(owner, r), content(r).publicCopy(locale),
                List.of());
    }
    private ItemView view(ItemIdentity owner, ItemRevision r) {
        var c = content(r);
        return new ItemView(owner.getId(), owner.getCode(), revisionView(owner, r), c, readiness(r, c));
    }
    private ItemView.Revision revisionView(ItemIdentity i, ItemRevision r) {
        return new ItemView.Revision(r.getId(), i.getId(), i.getCode(), r.getRulesetId(), r.getRevisionNo(),
                r.getState(), r.getVersion(), r.getPublicationSequence(), r.getPublishedAt(), r.getCause(),
                r.getEffectiveFromPatchVariantId(), r.getSourceRevisionId(), r.getCreatedAt(), r.getUpdatedAt());
    }
    private void context(UUID ruleset, UUID effective, boolean publication) {
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
    private long ordinal(ItemRevision r) {
        return ordinal(r.getEffectiveFromPatchVariantId());
    }
    private long ordinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }
    private void bump(ItemRevision r) {
        var a = actors.require();
        r.setVersion(r.getVersion() + 1);
        r.setUpdatedAt(clock.instant());
        r.setUpdatedByIssuer(a.issuer());
        r.setUpdatedBySubject(a.subject());
    }
    private void record(String action, ItemIdentity owner, ItemRevision r, String note) {
        audit.record(new AuditEntry(actors.require(), "ITEM_" + action, "ITEM", owner.getId(), r.getId(),
                r.getVersion() == 1 ? null : r.getVersion() - 1, r.getVersion(), note, Map.of()));
    }
    private void validate(ItemContent c) {
        if (c == null)
            fail("Content is required.");
        if (c.categoryCode() != null && !metadata.existsById(c.categoryCode()))
            fail("Unknown item category.");
        for (var position : c.shopPositions())
            if (position.categoryCode() == null || !metadata.existsById(position.categoryCode()))
                fail("Unknown shop category.");
        texts(c.translations());
        asset(c.iconAssetId());
        if (c.notes() != null && c.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (c.tier() != null && (c.tier() < 1 || c.tier() > 3) || c.price() != null && c.price() < 0)
            fail("Invalid tier or price.");
        if (!Set.of("UNKNOWN", "NONE", "VERIFIED").contains(c.recipeStatus()))
            fail("Unknown recipe status.");
        if (!c.recipeStatus().equals("VERIFIED") && !c.components().isEmpty())
            fail("Only verified recipes may have confirmed components.");
        if (c.components().stream().map(ItemContent.Component::itemId).distinct().count() != c.components().size())
            fail("Duplicate recipe component.");
        for (var component : c.components()) {
            if (component.itemId() == null || component.quantity() < 1 || component.quantity() > 100
                    || !identities.existsById(component.itemId()))
                fail("Invalid recipe component.");
        }
        for (var p : c.shopPositions())
            if (p.categoryCode() == null || p.row() != null && p.row() < 0 || p.column() != null && p.column() < 0)
                fail("Invalid shop position.");
        stats(c.stats());
    }
    private void texts(List<Translation> copy) {
        if (copy.size() > 50)
            fail("Too many translations.");
        var seen = new HashSet<String>();
        for (var t : copy) {
            if (t.locale() == null || !t.locale().matches("[a-z]{2,3}(?:-[A-Z]{2})?") || !seen.add(t.locale()))
                fail("Invalid or duplicate translation locale.");
            if (t.name() == null || t.name().isBlank() || t.name().length() > 255
                    || t.summary() != null && t.summary().length() > 2000
                    || t.description() != null && t.description().length() > 32768)
                fail("Invalid localized content.");
        }
    }
    private void stats(List<Stat> stats) {
        var keys = new HashSet<String>();
        for (var stat : stats)
            if (stat.key() == null || !stat.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*") || stat.value() == null
                    || !keys.add(stat.key()))
                fail("Invalid or duplicate numeric stat.");
    }
    private void asset(UUID id) {
        if (id != null
                && media.find(id).filter(a -> a.usable() && a.semanticType() == MediaSemanticType.ITEM_ICON).isEmpty())
            fail("The icon must be an active uploaded item icon.");
    }
    private List<UUID> assets(ItemContent c) {
        var result = new ArrayList<UUID>();
        if (c.iconAssetId() != null)
            result.add(c.iconAssetId());

        return result;
    }
    private List<String> readiness(ItemRevision revision, ItemContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null)
            result.add("effectiveFromPatchVariantId");
        return result;
    }
    private List<String> missing(ItemContent c) {
        var missing = new ArrayList<String>();
        if (c.iconAssetId() == null)
            missing.add("iconAssetId");
        if (c.translations().isEmpty())
            missing.add("translations");
        for (var t : c.translations())
            if (t.description() == null || t.description().isBlank())
                missing.add("translations." + t.locale() + ".description");
        if (c.tier() == null)
            missing.add("tier");
        if (c.price() == null)
            missing.add("price");
        if (c.categoryCode() == null)
            missing.add("categoryCode");
        if (c.recipeStatus().equals("UNKNOWN"))
            missing.add("recipeStatus");
        return missing;
    }
    private void checkRecipeCycle(UUID owner, ItemContent candidate, UUID ruleset, Set<UUID> visiting) {
        for (var component : candidate.components()) {
            if (component.itemId().equals(owner))
                fail("The recipe would create a cycle.");
            if (!visiting.add(component.itemId()))
                continue;
            var other = latest(identity(component.itemId()), ruleset);
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
}
