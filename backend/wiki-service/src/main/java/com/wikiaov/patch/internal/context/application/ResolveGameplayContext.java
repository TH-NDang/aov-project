package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.context.persistence.GameplayContextRepository;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.season.persistence.RankedSeasonRepository;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional(readOnly = true)
public class ResolveGameplayContext implements GameplayContexts {
    private final GameplayContextRepository contexts;
    private final RegionRepository regions;
    private final PatchVariantRepository variants;
    private final RankedSeasonRepository seasons;
    private final GameplayRulesetRepository rulesets;

    public ResolveGameplayContext(GameplayContextRepository contexts, RegionRepository regions,
            PatchVariantRepository variants, RankedSeasonRepository seasons, GameplayRulesetRepository rulesets) {
        this.contexts = contexts;
        this.regions = regions;
        this.variants = variants;
        this.seasons = seasons;
        this.rulesets = rulesets;
    }

    public GameplayContext resolve(String region, Instant at) {
        regions.findByCodeAndLifecycleState(region, "ACTIVE").orElseThrow(
                () -> new ApiException(RegionErrorCode.UNSUPPORTED_REGION, "The requested region is unavailable."));
        return contexts.effective(region, at, PageRequest.of(0, 1)).stream().findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                        "No verified gameplay context is available for this region and time."));
    }

    public GameplayContext resolveCatalog(String region, Instant at, UUID seasonId, UUID patchVariantId) {
        var current = resolve(region, at);
        if (seasonId == null && patchVariantId == null)
            return current;

        var selected = contexts.catalogPatches(current.rulesetId(), at, current.rulesetOrdinal(), seasonId,
                patchVariantId, PageRequest.of(0, 1)).stream().findFirst().orElseThrow(
                        () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND,
                                "The requested season or patch is unavailable for this catalog."));
        if (selected.getId().equals(current.patchVariantId()))
            return current;

        var date = contexts.catalogDates(current.regionId(), List.of(selected.getId()), at).stream().findFirst()
                .orElse(null);
        return new GameplayContext(current.regionId(), current.regionCode(), current.rulesetId(), current.rulesetCode(),
                selected.getPatchId(), selected.getCode(), selected.getId(), selected.getOrdinal(),
                date == null ? null : date.getEffectiveAt());
    }

    public List<GameplayContext> active(Instant at) {
        return regions.findByLifecycleState("ACTIVE").stream().map(region -> {
            try {
                return resolve(region.getCode(), at);
            } catch (ApiException exception) {
                if (exception.getErrorCode() == PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE)
                    return null;
                throw exception;
            }
        }).filter(java.util.Objects::nonNull).toList();
    }

    public void requireRuleset(UUID rulesetId) {
        if (!rulesets.existsByIdAndLifecycleState(rulesetId, "ACTIVE"))
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "The ruleset is unavailable.");
    }

    public PatchVariantReference variant(UUID variantId) {
        return variantView(variants.findById(variantId).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant does not exist.")));
    }

    public List<PatchVariantReference> catalogVariants(UUID seasonId) {
        if (seasonId != null && !seasons.existsById(seasonId))
            throw new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The season does not exist.");
        return (seasonId == null ? variants.findAll() : variants.findBySeasonId(seasonId)).stream()
                .map(this::variantView).toList();
    }

    public List<RulesetReference> rulesets() {
        return rulesets.activeReferences();
    }

    public List<PatchVariantReference> rulesetVariants(UUID rulesetId) {
        return variants.referencesByRuleset(rulesetId);
    }

    public List<AuthoringContext> authoring(UUID regionId, UUID seasonId) {
        return regionId == null ? contexts.authoringBySeason(seasonId) : contexts.authoringByMarket(regionId, seasonId);
    }

    public AuthoringContext authoringContext(UUID contextId) {
        var shared = contexts.sharedAuthoringContext(contextId);
        if (!shared.isEmpty())
            return shared.getFirst();
        // Keep accepted jobs using legacy release IDs executable after migration.
        return contexts.legacyAuthoringContext(contextId).stream().findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                        "Choose a patch within a known season."));
    }

    private PatchVariantReference variantView(PatchVariant variant) {
        return new PatchVariantReference(variant.getId(), variant.getPatchId(), variant.getRulesetId(),
                variant.getSeasonId(), variant.getRulesetOrdinal(), "PUBLISHED".equals(variant.getStatus()));
    }
}
