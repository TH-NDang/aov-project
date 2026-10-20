package com.wikiaov.spell.internal.application.service;
import com.wikiaov.access.*;
import com.wikiaov.media.*;
import com.wikiaov.patch.*;
import com.wikiaov.platform.*;
import com.wikiaov.platform.CatalogText.*;
import com.wikiaov.spell.SpellChangeQueries;
import com.wikiaov.spell.internal.application.*;
import com.wikiaov.spell.internal.application.SpellCommands.*;
import com.wikiaov.spell.internal.application.response.SpellRemovalView;
import com.wikiaov.spell.internal.application.response.SpellView;
import com.wikiaov.spell.internal.domain.SpellContent;
import com.wikiaov.spell.internal.persistence.*;
import com.wikiaov.spell.internal.persistence.entity.*;
import java.time.Clock;
import java.util.*;
import org.springframework.data.domain.Sort;
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
    private final SpellTranslationRepository translations;
    private final SpellRemovalRepository removals;
    private final GameplayContexts contexts;
    private final MediaAssets media;
    private final CurrentActor actors;
    private final AuditLog audit;
    private final Clock clock;
    public SpellCatalog(PatchDataReviews dataReviews, SpellPatchChangeRepository patchChanges,
            SpellIdentityRepository identities,
            SpellRevisionRepository revisions,
            SpellTranslationRepository translations, SpellRemovalRepository removals,
            GameplayContexts contexts, MediaAssets media, CurrentActor actors, AuditLog audit, Clock clock) {
        this.dataReviews = dataReviews;
        this.patchChanges = patchChanges;
        this.identities = identities;
        this.revisions = revisions;
        this.translations = translations;
        this.removals = removals;
        this.contexts = contexts;
        this.media = media;
        this.actors = actors;
        this.audit = audit;
        this.clock = clock;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size) {
        return list(rulesetId, locale, q, page, size, null, null);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
            UUID seasonId, UUID patchVariantId) {
        return list(rulesetId, locale, q, page, size, seasonId, patchVariantId, false);
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<SpellView> list(UUID rulesetId, String locale, String q, int page, int size,
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
                removals.findAll().stream().filter(f -> (rulesetId == null || rulesetId.equals(f.getRulesetId()))
                        && allowed.contains(f.getPatchVariantId())).map(f -> f.getRevisionId())
                        .forEach(explicitTargets::add);
                candidates = candidates.stream()
                        .filter(r -> explicitTargets.contains(r.getId()) || r.getEffectiveFromPatchVariantId() != null
                                && recorded.getOrDefault(r.getOwnerId(), Set.of())
                                        .contains(r.getEffectiveFromPatchVariantId()))
                        .toList();
            }
        }
        var selected = candidates.stream()
                .collect(java.util.stream.Collectors.toMap(SpellRevision::getOwnerId,
                        java.util.function.Function.identity(),
                        (a, b) -> compareSnapshots(a, b, ordinals) >= 0 ? a : b));
        var copies = translations.findByRevisionIdIn(selected.values().stream().map(SpellRevision::getId).toList())
                .stream()
                .collect(java.util.stream.Collectors.groupingBy(SpellTranslation::getRevisionId));
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
            return new SpellView(i.getId(), i.getCode(), revisionView(i, r), c, readiness(r, c));
        }).toList();
        return new PageSlice<>(pageRows, page, size, owners.size());
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public SpellView latest(UUID id, UUID rulesetId) {
        var found = latest(identity(id), rulesetId);
        if (found == null)
            throw new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "No snapshot is available.");
        return found;
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public SpellView read(UUID id, UUID revisionId) {
        return view(identity(id), revision(id, revisionId));
    }
    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<SpellView.Revision> history(UUID id) {
        var owner = identity(id);
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().map(r -> revisionView(owner, r)).toList();
    }
    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView create(Create input) {
        if (identities.findByCode(input.code()).isPresent())
            conflict("The code is already in use.");
        context(input.rulesetId(), input.effectiveFromPatchVariantId(), false);
        var actor = actors.require();
        var owner = new SpellIdentity();
        owner.setId(UUID.randomUUID());
        owner.setCode(input.code());
        owner.setCreatedAt(clock.instant());
        owner.setCreatedByIssuer(actor.issuer());
        owner.setCreatedBySubject(actor.subject());
        identities.saveAndFlush(owner);
        var content = input.content() == null
                ? new SpellContent(null, null, null, "UNKNOWN", "UNKNOWN", false, 0, null, null, null, List.of(),
                        List.of(),
                        List.of(new Translation(input.initialLocale(), input.name(), null, null, null, null)), null)
                : input.content();
        validate(content);
        var r = draft(owner, input.rulesetId(), null, "DATA_BASELINE", input.effectiveFromPatchVariantId());
        saveContent(r, content);
        record("CREATED", owner, r, null);
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView fork(UUID id, Fork input) {
        var owner = lock(id);
        var source = revision(id, input.sourceRevisionId());
        if (!source.getState().equals("PUBLISHED") || !source.getRulesetId().equals(input.rulesetId()))
            fail("The source must be published in the selected ruleset.");
        if (!Set.of("GAME_PATCH", "CONTENT_CORRECTION", "TRANSLATION_UPDATE").contains(input.cause()))
            fail("Invalid revision cause.");
        if (source.getEffectiveFromPatchVariantId() == null && input.cause().equals("GAME_PATCH"))
            fail("An archive without a known patch cannot be used as a gameplay baseline. Record removal evidence separately.");
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
    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView update(UUID id, UUID revisionId, Update input) {
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        validate(input.content());
        if (r.getCause().equals("TRANSLATION_UPDATE")
                && !r.getGameplay().mechanics().equals(input.content().mechanics()))
            fail("Translation revisions cannot change gameplay fields.");
        boolean contextChanged = input.effectiveFromPatchVariantId() != null
                && !Objects.equals(input.effectiveFromPatchVariantId(), r.getEffectiveFromPatchVariantId());
        boolean clearContext = Boolean.TRUE.equals(input.clearPatchContext());
        if (clearContext && (input.effectiveFromPatchVariantId() != null || !input.content().legacy()
                || !input.content().availability().equals("REMOVED")))
            fail("Only a removed legacy baseline can clear its patch context.");
        if (contextChanged || clearContext) {
            if (!r.getCause().equals("DATA_BASELINE") || r.getSourceRevisionId() != null)
                fail("Only an independent baseline draft can change its observation context.");
            context(r.getRulesetId(), input.effectiveFromPatchVariantId(), !clearContext);
            r.setEffectiveFromPatchVariantId(input.effectiveFromPatchVariantId());
        }

        if (content(r).equals(input.content()) && !contextChanged && !clearContext)
            return view(owner, r);
        saveContent(r, input.content());
        bump(r);
        record("DRAFT_UPDATED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('spell:publish')")
    public SpellView publish(UUID id, UUID revisionId, Mutation input) {
        var owner = lock(id);
        var r = editable(id, revisionId, input.expectedVersion());
        var content = content(r);
        context(r.getRulesetId(), r.getEffectiveFromPatchVariantId(), !archived(r, content));
        var missing = readiness(r, content);
        if (!missing.isEmpty())
            throw new ApiException(SpellErrorCode.SPELL_INVALID_CONTENT,
                    "Complete the required fields before publication.", Map.of("missingFields", missing));
        validate(content(r));
        r.setPublicationSequence(revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream()
                .filter(v -> v.getRulesetId().equals(r.getRulesetId()))
                .map(SpellRevision::getPublicationSequence).filter(Objects::nonNull).mapToLong(Long::longValue).max()
                .orElse(0) + 1);
        r.setState("PUBLISHED");
        r.setPublishedAt(clock.instant());
        bump(r);
        if (Set.of("DATA_BASELINE", "GAME_PATCH").contains(r.getCause()))
            dataReviews.markDirty(r.getEffectiveFromPatchVariantId());
        record("PUBLISHED", owner, r, input.changeNote());
        return view(owner, r);
    }
    @PreAuthorize("hasAuthority('spell:write')")
    public SpellView discard(UUID id, UUID revisionId, Mutation input) {
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
                    return new MediaUsage("SPELL", "SPELL", r.getOwnerId(), r.getId(), "ICON",
                            r.getState().equals("DRAFT")
                                    ? MediaUsageScope.DRAFT
                                    : current ? MediaUsageScope.CURRENT : MediaUsageScope.HISTORICAL);
                }).toList();
    }
    @Transactional(readOnly = true)
    public PageSlice<SpellView> published(String region, String locale, int page, int size) {
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
    public SpellView publishedOne(UUID id, String region, String locale) {
        var owner = identity(id);
        var ctx = contexts.resolve(region, clock.instant());
        return current(id, ctx).map(r -> publicView(owner, r, locale)).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "No published snapshot is available."));
    }
    private Optional<SpellRevision> current(UUID id, GameplayContext ctx) {
        var lifecycle = patchChanges.findByOwnerId(id).stream()
                .filter(f -> f.getRulesetId().equals(ctx.rulesetId()) && f.getKinds().stream()
                        .anyMatch(k -> k == CatalogChanges.Kind.REMOVED || k == CatalogChanges.Kind.ADDED))
                .filter(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal() <= ctx.rulesetOrdinal())
                .max(Comparator.comparingLong(f -> contexts.variant(f.getPatchVariantId()).rulesetOrdinal()));
        if (lifecycle.isPresent() && lifecycle.get().getKinds().contains(CatalogChanges.Kind.REMOVED))
            return Optional.empty();
        return revisions.findByOwnerIdOrderByRevisionNoDesc(id).stream().filter(r -> r.getState().equals("PUBLISHED")
                && r.getEffectiveFromPatchVariantId() != null
                && r.getRulesetId().equals(ctx.rulesetId()) && ordinal(r) <= ctx.rulesetOrdinal())
                .max(Comparator.<SpellRevision>comparingLong(this::ordinal)
                        .thenComparingLong(r -> r.getPublicationSequence() == null ? 0 : r.getPublicationSequence()));
    }
    private int compareSnapshots(SpellRevision a, SpellRevision b, Map<UUID, Long> ordinals) {
        long first = a.getEffectiveFromPatchVariantId() == null
                ? 0
                : ordinals.computeIfAbsent(a.getEffectiveFromPatchVariantId(), this::ordinal);
        long second = b.getEffectiveFromPatchVariantId() == null
                ? 0
                : ordinals.computeIfAbsent(b.getEffectiveFromPatchVariantId(), this::ordinal);
        int difference = Long.compare(first, second);
        return difference != 0 ? difference : Long.compare(a.getRevisionNo(), b.getRevisionNo());
    }
    private SpellView latest(SpellIdentity owner, UUID rulesetId) {
        return revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                .filter(r -> !r.getState().equals("DISCARDED")
                        && (rulesetId == null || r.getRulesetId().equals(rulesetId)))
                .max(Comparator.<SpellRevision>comparingLong(this::ordinal)
                        .thenComparingLong(SpellRevision::getRevisionNo))
                .map(r -> view(owner, r)).orElse(null);
    }
    private SpellIdentity identity(UUID id) {
        return identities.findById(id).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "The catalog entry was not found."));
    }
    private SpellIdentity lock(UUID id) {
        return identities.lockById(id).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_NOT_FOUND, "The catalog entry was not found."));
    }
    private SpellRevision revision(UUID id, UUID revisionId) {
        return revisions.findById(revisionId).filter(r -> r.getOwnerId().equals(id)).orElseThrow(
                () -> new ApiException(SpellErrorCode.SPELL_REVISION_NOT_FOUND, "The revision was not found."));
    }
    private SpellRevision editable(UUID id, UUID revisionId, long expected) {
        var r = revision(id, revisionId);
        if (!r.getState().equals("DRAFT"))
            conflict("Only drafts can be edited.");
        if (r.getVersion() != expected)
            throw new ApiException(SpellErrorCode.SPELL_CONFLICT, "The draft has changed.",
                    Map.of("currentVersion", r.getVersion()));
        return r;
    }
    private SpellRevision draft(SpellIdentity owner, UUID ruleset, UUID source, String cause, UUID effective) {
        var history = revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId());
        if (history.stream().anyMatch(r -> r.getRulesetId().equals(ruleset) && r.getState().equals("DRAFT")))
            conflict("A draft already exists for the ruleset.");
        var a = actors.require();
        var r = new SpellRevision();
        r.setId(UUID.randomUUID());
        r.setOwnerId(owner.getId());
        r.setRulesetId(ruleset);
        r.setRevisionNo(history.stream().filter(v -> v.getRulesetId().equals(ruleset))
                .mapToLong(SpellRevision::getRevisionNo).max().orElse(0) + 1);
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
    private void saveContent(SpellRevision r, SpellContent content) {
        var cleanStates = content.states().stream()
                .map(state -> new SpellContent.SpellState(state.key(), state.iconAssetId(), List.of())).toList();
        var clean = new SpellContent(content.iconAssetId(), content.cooldownSeconds(), content.unlockLevel(),
                content.unlockType(), content.availability(), content.legacy(), content.displayOrder(),
                content.chargeRechargeSeconds(), content.maxCharges(), content.defaultStateKey(), cleanStates,
                content.referenceImages(), List.of(), content.notes());
        r.setGameplay(clean);
        r.setIconAssetId(content.iconAssetId());
        revisions.saveAndFlush(r);
        translations.deleteByRevisionId(r.getId());
        translations.flush();
        for (var t : content.translations()) {
            var row = new SpellTranslation();
            row.setId(UUID.randomUUID());
            row.setRevisionId(r.getId());
            row.setLocale(t.locale());
            row.setTargetKey("");
            row.setName(t.name());
            row.setSummary(t.summary());
            row.setDescription(t.description());
            row.setStatLabels(t.statLabels());
            row.setEffects(t.effects());
            row.setVariantLabels(t.variantLabels());
            translations.save(row);
        }
        for (var state : content.states())
            for (var t : state.translations()) {
                var row = new SpellTranslation();
                row.setId(UUID.randomUUID());
                row.setRevisionId(r.getId());
                row.setTargetKey(state.key());
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
    private SpellContent content(SpellRevision r) {
        return hydrate(r, translations.findByRevisionIdOrderByLocale(r.getId()));
    }
    private SpellContent hydrate(SpellRevision r, List<SpellTranslation> copy) {
        var c = r.getGameplay();
        var states = c.states().stream()
                .map(state -> new SpellContent.SpellState(state.key(), state.iconAssetId(), copy.stream()
                        .filter(t -> t.getTargetKey().equals(state.key())).map(SpellTranslation::content).toList()))
                .toList();
        return new SpellContent(c.iconAssetId(), c.cooldownSeconds(), c.unlockLevel(), c.unlockType(), c.availability(),
                c.legacy(), c.displayOrder(), c.chargeRechargeSeconds(), c.maxCharges(), c.defaultStateKey(), states,
                c.referenceImages(),
                copy.stream().filter(t -> t.getTargetKey().isEmpty()).map(SpellTranslation::content).toList(),
                c.notes());
    }
    private SpellView publicView(SpellIdentity owner, SpellRevision r, String locale) {
        return new SpellView(owner.getId(), owner.getCode(), revisionView(owner, r), content(r).publicCopy(locale),
                List.of());
    }
    private SpellView view(SpellIdentity owner, SpellRevision r) {
        var c = content(r);
        return new SpellView(owner.getId(), owner.getCode(), revisionView(owner, r), c, readiness(r, c));
    }
    private SpellView.Revision revisionView(SpellIdentity i, SpellRevision r) {
        return new SpellView.Revision(r.getId(), i.getId(), i.getCode(), r.getRulesetId(), r.getRevisionNo(),
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
    private long ordinal(SpellRevision r) {
        return ordinal(r.getEffectiveFromPatchVariantId());
    }
    private long ordinal(UUID id) {
        return id == null ? 0 : contexts.variant(id).rulesetOrdinal();
    }
    private void bump(SpellRevision r) {
        var a = actors.require();
        r.setVersion(r.getVersion() + 1);
        r.setUpdatedAt(clock.instant());
        r.setUpdatedByIssuer(a.issuer());
        r.setUpdatedBySubject(a.subject());
    }
    private void record(String action, SpellIdentity owner, SpellRevision r, String note) {
        audit.record(new AuditEntry(actors.require(), "SPELL_" + action, "SPELL", owner.getId(), r.getId(),
                r.getVersion() == 1 ? null : r.getVersion() - 1, r.getVersion(), note, Map.of()));
    }
    private void validate(SpellContent c) {
        if (c == null)
            fail("Content is required.");
        texts(c.translations());
        asset(c.iconAssetId());
        if (c.notes() != null && c.notes().length() > 32768)
            fail("Notes exceed the maximum length.");
        if (c.cooldownSeconds() != null && c.cooldownSeconds().signum() < 0
                || c.chargeRechargeSeconds() != null && c.chargeRechargeSeconds().signum() < 0
                || c.unlockLevel() != null && c.unlockLevel() < 1 || c.maxCharges() != null && c.maxCharges() < 1
                || c.displayOrder() < 0)
            fail("Invalid spell numeric field.");
        if (!Set.of("AVAILABLE", "REMOVED", "UNKNOWN").contains(c.availability())
                || !Set.of("ACCOUNT_CREATION", "LEVEL", "UNKNOWN").contains(c.unlockType()))
            fail("Invalid spell availability or unlock type.");
        if (c.states().stream().map(SpellContent.SpellState::key).distinct().count() != c.states().size())
            fail("Duplicate spell state.");
        for (var state : c.states()) {
            if (state.key() == null || !state.key().matches("[a-z0-9]+(?:-[a-z0-9]+)*"))
                fail("Invalid spell state key.");
            asset(state.iconAssetId());
            texts(state.translations());
        }
        if (c.defaultStateKey() != null && c.states().stream().noneMatch(s -> s.key().equals(c.defaultStateKey())))
            fail("The default spell state must exist.");
        c.referenceImages().forEach(i -> asset(i.assetId()));
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
                && media.find(id).filter(a -> a.usable() && a.semanticType() == MediaSemanticType.SPELL_ICON).isEmpty())
            fail("The icon must be an active uploaded spell icon.");
    }
    private List<UUID> assets(SpellContent c) {
        var result = new ArrayList<UUID>();
        if (c.iconAssetId() != null)
            result.add(c.iconAssetId());
        c.states().forEach(s -> {
            if (s.iconAssetId() != null)
                result.add(s.iconAssetId());
        });
        c.referenceImages().forEach(i -> {
            if (i.assetId() != null)
                result.add(i.assetId());
        });
        return result;
    }
    private List<String> readiness(SpellRevision revision, SpellContent content) {
        var result = new ArrayList<>(missing(content));
        if (revision.getEffectiveFromPatchVariantId() == null && !archived(revision, content))
            result.add("effectiveFromPatchVariantId");
        return result;
    }
    private boolean archived(SpellRevision revision, SpellContent content) {
        return revision.getEffectiveFromPatchVariantId() == null && !revision.getCause().equals("GAME_PATCH")
                && content.legacy() && content.availability().equals("REMOVED");
    }

    @Transactional(readOnly = true)
    public PageSlice<SpellView> archives(String region, String locale, int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw new ApiException(PlatformErrorCode.INVALID_QUERY_PARAMETER, "Invalid page bounds.");
        var context = contexts.resolve(region, clock.instant());
        var rows = identities.findAll(Sort.by("code")).stream()
                .map(owner -> revisions.findByOwnerIdOrderByRevisionNoDesc(owner.getId()).stream()
                        .filter(r -> r.getState().equals("PUBLISHED") && r.getRulesetId().equals(context.rulesetId())
                                && archived(r, r.getGameplay()))
                        .max(Comparator.comparingLong(r -> r.getPublicationSequence()))
                        .map(r -> publicView(owner, r, locale)).orElse(null))
                .filter(Objects::nonNull).toList();
        int start = (int) Math.min((long) page * size, rows.size());
        return new PageSlice<>(rows.subList(start, Math.min(start + size, rows.size())), page, size, rows.size());
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<SpellRemovalView> removals(UUID id, UUID rulesetId) {
        identity(id);
        contexts.requireRuleset(rulesetId);
        return removals.findBySpellIdAndRulesetIdOrderByRecordedAtDesc(id, rulesetId).stream()
                .map(SpellRemovalView::from).toList();
    }

    @PreAuthorize("hasAuthority('spell:publish')")
    public SpellRemovalView recordRemoval(UUID id, Removal input) {
        var owner = lock(id);
        var snapshot = revision(id, input.revisionId());
        var content = snapshot.getGameplay();
        if (!snapshot.getState().equals("PUBLISHED") || !content.legacy() || !content.availability().equals("REMOVED"))
            fail("Removal evidence requires a published legacy spell marked as removed.");
        context(snapshot.getRulesetId(), input.patchVariantId(), true);
        try {
            var url = java.net.URI.create(input.sourceUrl());
            if (url.getHost() == null || url.getScheme() == null
                    || !Set.of("http", "https").contains(url.getScheme().toLowerCase(Locale.ROOT))
                    || url.getUserInfo() != null)
                fail("A valid HTTP(S) evidence URL is required.");
        } catch (IllegalArgumentException e) {
            fail("A valid HTTP(S) evidence URL is required.");
        }
        if (removals.existsBySpellIdAndPatchVariantId(id, input.patchVariantId())
                || patchChanges.existsByOwnerIdAndPatchVariantId(id, input.patchVariantId()))
            conflict("Removal evidence already exists for this spell and patch.");
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
        removals.saveAndFlush(event);
        dataReviews.markDirty(input.patchVariantId());
        record("REMOVAL_RECORDED", owner, snapshot, input.sourceUrl());
        return SpellRemovalView.from(event);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> authoringRemovals(UUID variantId, String locale) {
        contexts.variant(variantId);
        return removalChanges(variantId, locale);
    }

    @Transactional(readOnly = true)
    public List<Map<String, Object>> forVariant(UUID variantId, String locale) {
        return contexts.variant(variantId).published() ? removalChanges(variantId, locale) : List.of();
    }

    private List<Map<String, Object>> removalChanges(UUID variantId, String locale) {
        return removals.findByPatchVariantIdOrderByRecordedAtDesc(variantId).stream().map(event -> {
            var owner = identity(event.getSpellId());
            var content = content(revision(owner.getId(), event.getRevisionId())).publicCopy(locale);
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
    private List<String> missing(SpellContent c) {
        var missing = new ArrayList<String>();
        if (c.iconAssetId() == null)
            missing.add("iconAssetId");
        if (c.translations().isEmpty())
            missing.add("translations");
        for (var t : c.translations())
            if (t.description() == null || t.description().isBlank())
                missing.add("translations." + t.locale() + ".description");
        if (c.cooldownSeconds() == null)
            missing.add("cooldownSeconds");
        if (c.availability().equals("UNKNOWN"))
            missing.add("availability");
        if (c.unlockType().equals("UNKNOWN") || c.unlockType().equals("LEVEL") && c.unlockLevel() == null)
            missing.add("unlockType");
        return missing;
    }

    private static void fail(String message) {
        throw new ApiException(SpellErrorCode.SPELL_INVALID_CONTENT, message);
    }
    private static void conflict(String message) {
        throw new ApiException(SpellErrorCode.SPELL_CONFLICT, message);
    }
}
