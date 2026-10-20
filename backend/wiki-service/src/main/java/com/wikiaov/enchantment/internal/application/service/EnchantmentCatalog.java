package com.wikiaov.enchantment.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.enchantment.internal.application.*;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.*;
import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
import com.wikiaov.enchantment.internal.domain.EnchantmentContent;
import com.wikiaov.enchantment.internal.persistence.*;
import com.wikiaov.enchantment.internal.persistence.entity.*;
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
public class EnchantmentCatalog {
    private final PatchDataReviews dataReviews;
    private final EnchantmentPatchChangeRepository patchChanges;
    private final EnchantmentIdentityRepository identities;
    private final EnchantmentRevisionRepository revisions;
    private final EnchantmentTranslationRepository translations;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    private final EnchantmentBranchRepository metadata;
    public EnchantmentCatalog(PatchDataReviews dataReviews, EnchantmentPatchChangeRepository patchChanges,
            EnchantmentIdentityRepository identities,
            EnchantmentRevisionRepository revisions,
            EnchantmentTranslationRepository translations,
            GameplayContexts contexts, MediaAssets media, CurrentActor actors, AuditLog audit, Clock clock,
            EnchantmentBranchRepository metadata) {
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
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId, boolean includeUnchanged) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        if (rulesetId != null)
            contexts.requireRuleset(rulesetId);
        String needle = q.strip().toLowerCase(Locale.ROOT);
        Map<UUID, Long> ordinals = new HashMap<>();
        var candidates = revisions.findByStateNot("DISCARDED").stream()
                .filter(r -> rulesetId == null || r.getRulesetId().equals(rulesetId)).toList();
        if (seasonId != null || patchVariantId != null) {
            var variants = contexts.catalogVariants(seasonId);
            if (patchVariantId != null) {
                var target = contexts.variant(patchVariantId);
                if (rulesetId != null && !rulesetId.equals(target.rulesetId())
                        || seasonId != null && !seasonId.equals(target.seasonId()))
                    throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER,
                            "The patch must belong to the selected season and ruleset.");
            }
            var allowed = variants.stream()
                    .filter(v -> (rulesetId == null || rulesetId.equals(v.rulesetId()))
                            && (patchVariantId == null || patchVariantId.equals(v.id())))
                    .map(PatchVariantReference::id).collect(java.util.stream.Collectors.toSet());
            if (includeUnchanged) {
                Map<UUID, Long> cutoffs = new HashMap<>();
                variants.stream().filter(v -> allowed.contains(v.id()))
                        .forEach(v -> cutoffs.merge(v.rulesetId(), v.rulesetOrdinal(), Math::max));
                var applicable = contexts.catalogVariants(null).stream()
                        .filter(v -> v.published() && v.rulesetOrdinal() <= cutoffs.getOrDefault(v.rulesetId(), -1L))
                        .map(PatchVariantReference::id).collect(java.util.stream.Collectors.toSet());
                candidates = candidates.stream().filter(r -> r.getState().equals("PUBLISHED")
                        && applicable.contains(r.getEffectiveFromPatchVariantId())).toList();
                var removed = patchChanges.findAll().stream()
                        .filter(f -> applicable.contains(f.getPatchVariantId()))
                        .collect(java.util.stream.Collectors.toMap(f -> f.getOwnerId(), f -> f,
                                (a, b) -> ordinal(a.getPatchVariantId()) >= ordinal(b.getPatchVariantId()) ? a : b));
                candidates = candidates.stream().filter(r -> {
                    var fact = removed.get(r.getOwnerId());
                    return fact == null || !fact.getKinds().contains(CatalogChanges.Kind.REMOVED)
                            || allowed.contains(fact.getPatchVariantId())
                            || ordinal(r.getEffectiveFromPatchVariantId()) > ordinal(fact.getPatchVariantId());
                }).toList();
            } else {
                var recorded = new HashMap<UUID, Set<UUID>>();
                for (var r : candidates)
                    if (allowed.contains(r.getEffectiveFromPatchVariantId())
                            && Set.of("DATA_BASELINE", "GAME_PATCH").contains(r.getCause()))
                        recorded.computeIfAbsent(r.getOwnerId(), ignored -> new HashSet<>())
                                .add(r.getEffectiveFromPatchVariantId());
                var explicitTargets = patchChanges.findAll().stream()
                        .filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                                && allowed.contains(f.getPatchVariantId()))
                        .map(f -> f.getToRevisionId()).collect(java.util.stream.Collectors.toSet());
                candidates = candidates.stream()
                        .filter(r -> explicitTargets.contains(r.getId()) || r.getEffectiveFromPatchVariantId() != null
                                && recorded.getOrDefault(r.getOwnerId(), Set.of())
                                        .contains(r.getEffectiveFromPatchVariantId()))
                        .toList();
            }
        }
        var selected = candidates.stream()
                .collect(java.util.stream.Collectors.toMap(EnchantmentRevision::getOwnerId,
                        java.util.function.Function.identity(),
                        (a, b) -> compareSnapshots(a, b, ordinals) >= 0 ? a : b));
        var copies = translations
                .findByRevisionIdIn(selected.values().stream().map(EnchantmentRevision::getId).toList()).stream()
                .collect(java.util.stream.Collectors.groupingBy(EnchantmentTranslation::getRevisionId));
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
            return new EnchantmentView(i.getId(), i.getCode(), revisionView(i, r), c, readiness(r, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public EnchantmentView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "No snapshot is available.");
        return found;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public EnchantmentView read(UUID id, UUID revisionId) {
        return view(identity(id), revision(id, revisionId));
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<EnchantmentView.Revision> history(UUID id) {
        var owner = identity(id);
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().map(r -> revisionView(owner, r)).toList();
    }
    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        context(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var actor = actors.require();
        var owner = new EnchantmentIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(input.code());
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        var content = input.content() == null
                ? new EnchantmentContent(null, null, null, null,
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        validate(content);
        var r = draft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        saveContent(r, content);
        record("CREATED", owner, r, null);
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView fork(UUID id, Fork input) {
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
    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView update(UUID id, UUID revisionId, Update input) {
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

        if (content(r).equals(input.content()) && !contextChanged)
            return view(owner, r);
        saveContent(r, input.content());
        bump(r);
        record("DRAFT_UPDATED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('enchantment:publish')")
    public EnchantmentView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        context(r.getRulesetId(), r.getEffectiveFromPatchVariantId(), true);
        var missing = missing(content(r));
        if (!missing.isEmpty())
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        validate(content(r));
        r.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(v -> v.getRulesetId().equals(r.getRulesetId()))
                .map(EnchantmentRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue)
                .max().orElse(0) + 1);
        r.setState("PUBLISHED");
        r.setPublishedAt(clock.instant());
        bump(r);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(r.getCause()))
            dataReviews.markDirty(r.getEffectiveFromPatchVariantId());
        record("PUBLISHED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('enchantment:write')")
    public List<EnchantmentView> reorder(EnchantmentOrdering.Nodes input) {
        if (metadata.lockByCode(input.branchCode()).isEmpty())
            fail("Unknown enchantment branch.");
        var ids = input.entries().stream().map(EnchantmentOrdering.Node::id).toList();
        if (new HashSet<>(ids).size() != ids.size())
            fail("Duplicate enchantment identities are not allowed.");
        var owners = new HashMap<UUID, EnchantmentIdentity>();
        ids.stream().sorted().forEach(id -> owners.put(id, lock(id)));
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
        var ordered = new ArrayList<EnchantmentRevision>();
        for (var entry : input.entries()) {
            var r = editable(entry.id(), entry.revisionId(), entry.expectedVersion());
            var g = r.getGameplay();
            var latest = latest(owners.get(entry.id()), input.rulesetId());
            if (!r.getRulesetId().equals(input.rulesetId()) || !input.branchCode().equals(g.branchCode())
                    || !Objects.equals(input.tier(), g.tier()) || latest == null
                    || !latest.revision().id().equals(r.getId()))
                conflict("Only the current drafts in the selected branch and tier can be reordered.");
            if (r.getCause().equals("TRANSLATION_UPDATE"))
                fail("Translation revisions cannot change gameplay fields.");
            ordered.add(r);
        }
        for (int index = 0; index < ordered.size(); index++) {
            var r = ordered.get(index);
            var g = r.getGameplay();
            if (Objects.equals(index, g.position()))
                continue;
            r.setGameplay(new EnchantmentContent(g.iconAssetId(), g.branchCode(), g.tier(), index,
                    List.of(), g.notes()));
            bump(r);
            revisions.saveAndFlush(r);
            record("REORDERED", owners.get(r.getOwnerId()), r, "Reorder enchantments within the same tier.");
        }
        return ordered.stream().map(r -> view(owners.get(r.getOwnerId()), r)).toList();
    }
    @PreAuthorize("hasAuthority('enchantment:write')")
    public EnchantmentView discard(UUID id, UUID revisionId, Mutation input) {
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
                    return new MediaUsage("ENCHANTMENT", "ENCHANTMENT", r.getOwnerId(), r.getId(), "ICON",
                            r.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }
    @Transactional(readOnly = true)
    public PageSlice<EnchantmentView> published(String region, String locale, int page, int size) {
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
    public EnchantmentView publishedOne(UUID id, String region, String locale) {
        var owner = identity(id);
        var ctx = contexts.resolve(region, clock.instant());
        return current(id, ctx).map(r -> publicView(owner, r, locale))
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND,
                        "No published snapshot is available."));
    }
    private Optional<EnchantmentRevision> current(UUID id, GameplayContext ctx) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(ctx.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= ctx.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED))
            return Optional.empty();
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().filter(r -> r.getState().equals("PUBLISHED")
                && r.getRulesetId().equals(ctx.rulesetId()) && ordinal(r) <= ctx.rulesetOrdinal())
                .max(Comparator.<EnchantmentRevision>comparingLong(this::ordinal)
                        .thenComparingLong(r -> r.getPublicationSequence() == null ? 0 : r.getPublicationSequence()));
    }
    private int compareSnapshots(EnchantmentRevision a, EnchantmentRevision b, Map<UUID, Long> ordinals) {
        long first = a.getEffectiveFromPatchVariantId() == null
                ? 0
                : ordinals.computeIfAbsent(a.getEffectiveFromPatchVariantId(), this::ordinal);
        long second = b.getEffectiveFromPatchVariantId() == null
                ? 0
                : ordinals.computeIfAbsent(b.getEffectiveFromPatchVariantId(), this::ordinal);
        int difference = Long.compare(first, second);
        return difference != 0 ? difference : Long.compare(a.getRevisionNo(), b.getRevisionNo());
    }
    private EnchantmentView latest(EnchantmentIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(r -> !r.getState().equals("DISCARDED")
                        && (rulesetId == null || r.getRulesetId().equals(rulesetId)))
                .max(Comparator.<EnchantmentRevision>comparingLong(this::ordinal)
                        .thenComparingLong(EnchantmentRevision::getRevisionNo))
                .map(r -> view(owner, r)).orElse(null);
    }
    private EnchantmentIdentity identity(UUID id) {
        return identities.findById(id).orElseThrow(
                () -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "The catalog entry was not found."));
    }
    private EnchantmentIdentity lock(UUID id) {
        return identities.lockById(id).orElseThrow(
                () -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_NOT_FOUND, "The catalog entry was not found."));
    }
    private EnchantmentRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(r -> r.getOwnerId().equals(id))
                .orElseThrow(() -> new ApiException(EnchantmentErrorCode.ENCHANTMENT_REVISION_NOT_FOUND,
                        "The revision was not found."));
    }
    private EnchantmentRevision editable(UUID id, UUID revisionId, long expected) {
        var r = revision(id, revisionId);
        if (!r.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (r.getVersion() != expected)
            throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", r.getVersion()));
        return r;
    }
    private EnchantmentRevision draft(EnchantmentIdentity owner, UUID ruleset, UUID source, String cause,
            UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream().anyMatch(r -> r.getRulesetId().equals(ruleset) && r.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var a = actors.require();
        var r = new EnchantmentRevision();
        r.setId(UUID.randomUUID());
        r.setOwnerId(owner.getId());
        r.setRulesetId(ruleset);
        r.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(EnchantmentRevision::getRevisionNo).max().orElse(0) + 1);
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
    private void saveContent(EnchantmentRevision r, EnchantmentContent content) {
        r.setGameplay(content.withTranslations(List.of()));
        r.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(r);
        translations.deleteByRevisionId(r.getId());
        translations.flush();
        for (var t : content.translations()) {
            var row = new EnchantmentTranslation();
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
    private EnchantmentContent content(EnchantmentRevision r) {
        return hydrate(r, translations.findByRevisionIdOrderByLocale(r.getId()));
    }
    private EnchantmentContent hydrate(EnchantmentRevision r, List<EnchantmentTranslation> copy) {
        return r.getGameplay().withTranslations(copy.stream().map(EnchantmentTranslation::content).toList());
    }
    private EnchantmentView publicView(EnchantmentIdentity owner, EnchantmentRevision r, String locale) {
        return new EnchantmentView(owner.getId(), owner.getCode(), revisionView(owner, r),
                content(r).publicCopy(locale), List.of());
    }
    private EnchantmentView view(EnchantmentIdentity owner, EnchantmentRevision r) {
        var c = content(r);
        return new EnchantmentView(owner.getId(), owner.getCode(), revisionView(owner, r), c, readiness(r, c));
    }
    private EnchantmentView.Revision revisionView(EnchantmentIdentity i, EnchantmentRevision r) {
        return new EnchantmentView.Revision(r.getId(), i.getId(), i.getCode(), r.getRulesetId(), r.getRevisionNo(),
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
    private long ordinal(EnchantmentRevision r) {
        return ordinal(r.getEffectiveFromPatchVariantId());
    }
    private long ordinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }
    private void bump(EnchantmentRevision r) {
        var a = actors.require();
        r.setVersion(r.getVersion() + 1);
        r.setUpdatedAt(clock.instant());
        r.setUpdatedByIssuer(a.issuer());
        r.setUpdatedBySubject(a.subject());
    }
    private void record(String action, EnchantmentIdentity owner, EnchantmentRevision r, String note) {
        audit.record(new AuditEntry(actors.require(), "ENCHANTMENT_" + action, "ENCHANTMENT", owner.getId(), r.getId(),
                r.getVersion() == 1 ? null : r.getVersion() - 1, r.getVersion(), note, Map.of()));
    }
    private void validate(EnchantmentContent c) {
        if (c == null)
            fail("Content is required.");
        if (c.branchCode() != null && !metadata.existsById(c.branchCode()))
            fail("Unknown enchantment branch.");
        texts(c.translations());
        asset(c.iconAssetId());
        if (c.notes() != null && c.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (c.tier() != null && (c.tier() < 1 || c.tier() > 3) || c.position() != null && c.position() < 0)
            fail("Invalid enchantment position.");
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
        if (id != null && media.find(id)
                .filter(a -> a.usable() && a.semanticType() == MediaSemanticType.ENCHANTMENT_ICON).isEmpty())
            fail("The icon must be an active uploaded enchantment icon.");
    }
    private List<UUID> assets(EnchantmentContent c) {
        var result = new ArrayList<UUID>();
        if (c.iconAssetId() != null)
            result.add(c.iconAssetId());

        return result;
    }
    private List<String> readiness(EnchantmentRevision revision, EnchantmentContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null)
            result.add("effectiveFromPatchVariantId");
        return result;
    }
    private List<String> missing(EnchantmentContent c) {
        var missing = new ArrayList<String>();
        if (c.iconAssetId() == null)
            missing.add("iconAssetId");
        if (c.translations().isEmpty())
            missing.add("translations");
        for (var t : c.translations())
            if (t.description() == null || t.description().isBlank())
                missing.add("translations." + t.locale() + ".description");
        if (c.branchCode() == null)
            missing.add("branchCode");
        if (c.tier() == null)
            missing.add("tier");
        if (c.position() == null)
            missing.add("position");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_INVALID_CONTENT, message);
    }
    private static void conflict(String message) {
        throw new ApiException(EnchantmentErrorCode.ENCHANTMENT_CONFLICT, message);
    }
}
