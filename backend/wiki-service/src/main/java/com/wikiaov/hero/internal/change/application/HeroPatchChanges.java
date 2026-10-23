package com.wikiaov.hero.internal.change.application;

import com.wikiaov.access.*;
import com.wikiaov.hero.HeroChangeQueries;
import com.wikiaov.hero.internal.application.HeroErrorCode;
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
        var to = store.revision(input.heroId(), input.toHeroRevisionId());
        if (!to.state().equals("PUBLISHED") || to.cause() != Cause.GAME_PATCH
                || !to.rulesetId().equals(variant.rulesetId()) || !variantId.equals(to.effectiveFromPatchVariantId()))
            throw HeroValidation
                    .invalid("The target must be a published GAME_PATCH revision for this variant and ruleset.");
        if (input.fromHeroRevisionId() != null) {
            var from = store.revision(input.heroId(), input.fromHeroRevisionId());
            if (!from.state().equals("PUBLISHED") || !from.rulesetId().equals(to.rulesetId())
                    || from.publicationSequence() >= to.publicationSequence())
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
        for (var change : input.changes()) {
            validateChange(change, input);
            if (change instanceof StatChange v && Objects.equals(v.oldValue(), v.newValue()))
                throw HeroValidation.invalid("A stat change must change the value.");
            history.appendChange(id, order++, change);
        }
        dataReviews.markDirty(variantId);
        audit.record(new AuditEntry(actor, "HERO_PATCH_CHANGE_RECORDED", "HERO", input.heroId(), to.id(), null, null,
                null, Map.of("changeSetId", id)));
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

    private void validateChange(Change change, com.wikiaov.hero.internal.domain.HeroChanges.Record input) {
        var to = store.revision(input.heroId(), input.toHeroRevisionId());
        var from = input.fromHeroRevisionId() == null
                ? null
                : store.revision(input.heroId(), input.fromHeroRevisionId());
        if (change instanceof StatChange v) {
            var newStats = (Stats) sections.content(HeroSection.COMBAT_STATS,
                    to.sections().get(HeroSection.COMBAT_STATS));
            var oldStats = from == null
                    ? new Stats(List.of(), List.of())
                    : (Stats) sections.content(HeroSection.COMBAT_STATS, from.sections().get(HeroSection.COMBAT_STATS));
            var newer = newStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            var older = oldStats.values().stream().filter(stat -> stat.statKey().equals(v.statKey())).findFirst();
            java.math.BigDecimal newValue = newer.map(Stat::baseValue).orElse(null),
                    oldValue = older.map(Stat::baseValue).orElse(null);
            if (!sameNumber(newValue, v.newValue()) || !sameNumber(oldValue, v.oldValue())
                    || newer.isPresent() && !newer.get().unit().equals(v.unit()))
                throw HeroValidation.invalid("Stat changes must match the source and target snapshots.");
        }
        if (change instanceof SkillChange v) {
            var skills = (Skills) sections.content(HeroSection.SKILLS, to.sections().get(HeroSection.SKILLS));
            if (skills.skills().stream().noneMatch(skill -> skill.skillKey().equals(v.skillKey())))
                throw HeroValidation.invalid("The skill key does not belong to the target snapshot.");
            if (Objects.equals(v.oldValue(), v.newValue()))
                throw HeroValidation.invalid("A skill change must change a value.");
        }
        if (change instanceof RoleChange v) {
            var newer = (Profile) sections.content(HeroSection.PROFILE, to.sections().get(HeroSection.PROFILE));
            var older = from == null
                    ? new Profile(List.of(), Set.of(), List.of())
                    : (Profile) sections.content(HeroSection.PROFILE, from.sections().get(HeroSection.PROFILE));
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
