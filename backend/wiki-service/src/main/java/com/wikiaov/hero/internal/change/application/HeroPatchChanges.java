package com.wikiaov.hero.internal.change.application;

import com.wikiaov.access.*;
import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.hero.internal.application.HeroErrorCode;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.authoring.application.HeroValidation;
import com.wikiaov.hero.internal.authoring.persistence.HeroStore;
import com.wikiaov.hero.internal.change.persistence.HeroPatchHistory;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.hero.internal.domain.HeroContent.*;
import com.wikiaov.hero.internal.domain.HeroContent.Cause;
import com.wikiaov.hero.internal.domain.HeroSection;
import com.wikiaov.hero.internal.sections.persistence.HeroSections;
import com.wikiaov.patch.GameplayContexts;
import com.wikiaov.patch.PatchCatalog;
import com.wikiaov.patch.PatchDataReviews;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.Clock;
import java.util.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class HeroPatchChanges implements HeroChangeQueries {
    private final PatchDataReviews dataReviews;
    private final HeroPatchHistory history;
    private final HeroStore store;
    private final PatchCatalog patches;
    private final HeroSections sections;
    private final GameplayContexts contexts;
    private final AuditLog audit;
    private final CurrentActor actors;
    private final Clock clock;

    public HeroPatchChanges(PatchDataReviews dataReviews,
            HeroPatchHistory history,
            HeroStore store, GameplayContexts contexts, AuditLog audit, CurrentActor actors,
            Clock clock, PatchCatalog patches, HeroSections sections) {
        this.dataReviews = dataReviews;
        this.history = history;
        this.patches = patches;
        this.sections = sections;
        this.store = store;
        this.contexts = contexts;
        this.audit = audit;
        this.actors = actors;
        this.clock = clock;
    }

    @Transactional
    @PreAuthorize("hasAuthority('patch:write')")
    public UUID record(UUID variantId, com.wikiaov.hero.internal.domain.HeroChanges.Record input) {
        store.lockHero(input.heroId());
        var variant = contexts.variant(variantId);
        boolean notes = input.source() == ChangeSource.PATCH_NOTES;
        if (!notes && input.toHeroRevisionId() == null)
            throw HeroValidation.invalid("A snapshot change set requires a target revision.");
        if (notes || input.sourceUrl() != null)
            requireSourceUrl(input.sourceUrl());

        var to = input.toHeroRevisionId() == null ? null : store.revision(input.heroId(), input.toHeroRevisionId());
        if (to != null && (!to.state().equals("PUBLISHED") || to.cause() != Cause.GAME_PATCH
                || !to.rulesetId().equals(variant.rulesetId()) || !variantId.equals(to.effectiveFromPatchVariantId())))
            throw HeroValidation
                    .invalid("The target must be a published GAME_PATCH revision for this variant and ruleset.");
        HeroRevisionView from = null;
        if (input.fromHeroRevisionId() != null) {
            from = store.revision(input.heroId(), input.fromHeroRevisionId());
            if (!from.state().equals("PUBLISHED") || !from.rulesetId().equals(variant.rulesetId())
                    || to != null && from.publicationSequence() >= to.publicationSequence())
                throw HeroValidation.invalid("The source revision must precede the target in the same ruleset.");
            if (from.effectiveFromPatchVariantId() != null && contexts.variant(from.effectiveFromPatchVariantId())
                    .rulesetOrdinal() >= variant.rulesetOrdinal())
                throw HeroValidation.invalid("The source must precede this gameplay patch.");
        }
        Set<String> locales = new HashSet<>();
        for (var t : input.summaryTranslations()) {
            HeroValidation.locale(t.locale());
            if (!locales.add(t.locale()))
                throw HeroValidation.invalid("Summary locales must be unique.");
        }
        if (notes)
            validateNotes(input.changes(), latestPublished(input.heroId(), variant.rulesetId()));
        else
            for (var change : input.changes())
                validateChange(change, from, to);

        UUID id = UUID.randomUUID();
        var actor = actors.require();
        try {
            history.create(id, variantId, input, clock.instant(), actor);
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(HeroErrorCode.HERO_PATCH_CHANGE_CONFLICT,
                    "A change set already exists for this hero and variant.");
        }
        for (var t : input.summaryTranslations())
            history.appendTranslation(id, t);
        int order = 0;
        for (var change : input.changes())
            history.appendChange(id, order++, change);

        dataReviews.markDirty(variantId);
        audit.record(new AuditEntry(actor, "HERO_PATCH_CHANGE_RECORDED", "HERO", input.heroId(),
                to == null ? null : to.id(), null, null, null,
                Map.of("changeSetId", id, "sourceKind", input.source().name())));
        return id;
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    public List<Map<String, Object>> forAuthoringVariant(UUID variantId, String locale) {
        HeroValidation.locale(locale);
        contexts.variant(variantId);
        return HeroPatchChangeViews.render(history.forVariant(variantId, locale));
    }

    public List<Map<String, Object>> forVariant(UUID variantId, String locale) {
        HeroValidation.locale(locale);
        if (!contexts.variant(variantId).published())
            return List.of();
        return HeroPatchChangeViews.render(history.forVariant(variantId, locale));
    }

    public PageSlice<Map<String, Object>> forHero(UUID heroId, String region, String locale, int page, int size) {
        HeroValidation.locale(locale);
        if (page < 0 || size < 1 || size > 100)
            throw HeroValidation.invalid("Invalid page bounds.");
        var variants = patches.releases(region).stream().filter(r -> !r.effectiveAt().isAfter(clock.instant()))
                .collect(java.util.stream.Collectors.toMap(com.wikiaov.patch.PatchReleaseReference::variantId, r -> r,
                        (a, b) -> a));
        var all = HeroPatchChangeViews.render(history.forHero(heroId, locale)).stream()
                .filter(row -> variants.containsKey((UUID) row.get("patchVariantId"))).peek(row -> {
                    var release = variants.get((UUID) row.get("patchVariantId"));
                    row.put("patch", patches.published(release.patchId(), region, locale));
                }).toList();
        return new PageSlice<>(all.stream().skip((long) page * size).limit(size).toList(), page, size, all.size());
    }

    private void validateChange(Change change, HeroRevisionView from, HeroRevisionView to) {
        if (change instanceof StatChange v) {
            var newStats = stats(to);
            var oldStats = from == null ? new Stats(List.of(), List.of()) : stats(from);
            var newer = newStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            var older = oldStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            java.math.BigDecimal newValue = newer.map(Stat::baseValue).orElse(null),
                    oldValue = older.map(Stat::baseValue).orElse(null);
            if (!sameNumber(newValue, v.newValue()) || !sameNumber(oldValue, v.oldValue())
                    || newer.isPresent() && !newer.get().unit().equals(v.unit()))
                throw HeroValidation.invalid("Stat changes must match the source and target snapshots.");
            if (sameNumber(v.oldValue(), v.newValue()))
                throw HeroValidation.invalid("A stat change must change the value.");
        }
        if (change instanceof SkillChange v) {
            if (skills(to).skills().stream().noneMatch(skill -> skill.skillKey().equals(v.skillKey())))
                throw HeroValidation.invalid("The skill key does not belong to the target snapshot.");
            if (Objects.equals(v.oldValue(), v.newValue()))
                throw HeroValidation.invalid("A skill change must change a value.");
        }
        if (change instanceof RoleChange v) {
            var newer = profile(to);
            var older = from == null ? new Profile(List.of(), Set.of(), List.of()) : profile(from);
            if (newer.roles().contains(v.roleCode()) != v.added() || older.roles().contains(v.roleCode()) == v.added())
                throw HeroValidation.invalid("Role changes must match the snapshots.");
        }
        if (change instanceof VisualChange v) {
            var newer = (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                    to.sections().get(HeroSection.MEDIA_BINDINGS));
            var older = from == null
                    ? new Bindings(Map.of(), List.of())
                    : (Bindings) sections.content(HeroSection.MEDIA_BINDINGS,
                            from.sections().get(HeroSection.MEDIA_BINDINGS));
            if (!Objects.equals(newer.bindings().get(v.mediaRole()), v.newAssetId())
                    || !Objects.equals(older.bindings().get(v.mediaRole()), v.oldAssetId())
                    || Objects.equals(v.oldAssetId(), v.newAssetId()))
                throw HeroValidation.invalid("Visual changes must match the snapshots.");
        }
    }

    /**
     * Patch notes carry both values of every stat and skill line, which is what the derived patch view applies. Keys are
     * checked against the latest published snapshot when the hero has one.
     */
    private void validateNotes(List<Change> changes, HeroRevisionView reference) {
        var stats = reference == null ? null : stats(reference);
        var skills = reference == null ? null : skills(reference);

        Set<String> touched = new HashSet<>();
        for (var change : changes) {
            switch (change) {
                case StatChange v -> {
                    if (v.oldValue() == null || v.newValue() == null)
                        throw HeroValidation.invalid("A stat change from patch notes needs the old and the new value.");
                    if (sameNumber(v.oldValue(), v.newValue()))
                        throw HeroValidation.invalid("A stat change must change the value.");
                    if (stats != null && stats.values().stream()
                            .noneMatch(stat -> stat.statKey().equals(v.statKey()) && stat.unit().equals(v.unit())))
                        throw HeroValidation
                                .invalid("The stat key and unit must belong to the latest published snapshot.");
                    if (!touched.add("stat:" + v.statKey()))
                        throw HeroValidation.invalid("A change set may change each stat once.");
                }
                case SkillChange v -> {
                    if (v.oldValue() == null || v.newValue() == null)
                        throw HeroValidation
                                .invalid("A skill change from patch notes needs the old and the new value.");
                    if (v.oldValue().equals(v.newValue()))
                        throw HeroValidation.invalid("A skill change must change a value.");
                    if (skills != null && skills.skills().stream().noneMatch(s -> s.skillKey().equals(v.skillKey())))
                        throw HeroValidation.invalid("The skill key does not belong to the latest published snapshot.");
                    if (!touched.add("skill:" + v.skillKey() + ":" + v.fieldKey()))
                        throw HeroValidation.invalid("A change set may change each skill field once.");
                }
                case RoleChange v -> {
                    if (!touched.add("role:" + v.roleCode()))
                        throw HeroValidation.invalid("A change set may change each role once.");
                }
                case VisualChange ignored ->
                    throw HeroValidation.invalid("Visual changes need snapshots and cannot come from patch notes.");
                case MechanicChange ignored -> {
                }
                case OtherChange ignored -> {
                }
            }
        }
    }

    private HeroRevisionView latestPublished(UUID heroId, UUID rulesetId) {
        return store.revisions(heroId).stream()
                .filter(revision -> revision.state().equals("PUBLISHED") && revision.rulesetId().equals(rulesetId))
                .max(Comparator.comparing(HeroRevisionView::publicationSequence)).orElse(null);
    }

    private Stats stats(HeroRevisionView revision) {
        return (Stats) sections.content(HeroSection.COMBAT_STATS, revision.sections().get(HeroSection.COMBAT_STATS));
    }

    private Skills skills(HeroRevisionView revision) {
        return (Skills) sections.content(HeroSection.SKILLS, revision.sections().get(HeroSection.SKILLS));
    }

    private Profile profile(HeroRevisionView revision) {
        return (Profile) sections.content(HeroSection.PROFILE, revision.sections().get(HeroSection.PROFILE));
    }

    private static void requireSourceUrl(String value) {
        try {
            var uri = value == null ? null : new URI(value);
            if (uri != null && uri.getHost() != null
                    && ("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme())))
                return;
        } catch (URISyntaxException ignored) {
            // Reported below together with a missing URL.
        }
        throw HeroValidation.invalid("The source must be an http(s) URL of the official patch notes.");
    }

    @io.swagger.v3.oas.annotations.media.Schema(name = "com.wikiaov.hero.internal.application.service.HeroPatchChanges.AssessmentInput")
    public record AssessmentInput(
            Kind kind,
            long expectedVersion
    ) {
    }

    @Transactional
    @PreAuthorize("hasAuthority('patch:write')")
    public Map<String, Object> assess(UUID changeSetId, AssessmentInput input) {
        UUID heroId = history.heroId(changeSetId)
                .orElseThrow(() -> HeroValidation.invalid("The hero change set was not found."));
        store.lockHero(heroId);
        if (input.kind() == null)
            throw HeroValidation.invalid("An overall classification is required.");
        var value = history.assessment(changeSetId)
                .orElseGet(com.wikiaov.hero.internal.change.persistence.entity.HeroPatchAssessment::new);
        if (value.getVersion() != input.expectedVersion())
            throw new ApiException(HeroErrorCode.HERO_PATCH_CHANGE_CONFLICT, "The overall assessment has changed.");
        var actor = actors.require();
        value.setChangeSetId(changeSetId);
        value.setKind(input.kind());
        value.setVersion(value.getVersion() + 1);
        value.setUpdatedAt(clock.instant());
        value.setUpdatedByIssuer(actor.issuer());
        value.setUpdatedBySubject(actor.subject());
        history.saveAssessment(value);
        audit.record(new AuditEntry(actor, "HERO_PATCH_ASSESSED", "HERO", heroId, null, input.expectedVersion(),
                value.getVersion(), null, Map.of("changeSetId", changeSetId, "kind", input.kind().name())));
        return Map.of("kind", value.getKind(), "version", value.getVersion());
    }

    private static boolean sameNumber(java.math.BigDecimal a, java.math.BigDecimal b) {
        return a == null ? b == null : b != null && a.compareTo(b) == 0;
    }

}
