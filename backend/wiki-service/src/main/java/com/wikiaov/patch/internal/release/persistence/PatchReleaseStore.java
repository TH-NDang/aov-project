package com.wikiaov.patch.internal.release.persistence;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RegionRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.patch.internal.ruleset.persistence.entity.Region;
import com.wikiaov.platform.ApiException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

/** Coordinates fresh timeline reads with the region-before-ruleset writer lock order. */
@Repository
public class PatchReleaseStore {
    private final RegionRepository regions;
    private final GameplayRulesetRepository rulesets;
    private final PatchVariantRepository variants;
    private final PatchReleaseRepository releases;
    private final RulesetAssignmentRepository assignments;

    public PatchReleaseStore(RegionRepository regions, GameplayRulesetRepository rulesets,
            PatchVariantRepository variants, PatchReleaseRepository releases, RulesetAssignmentRepository assignments) {
        this.regions = regions;
        this.rulesets = rulesets;
        this.variants = variants;
        this.releases = releases;
        this.assignments = assignments;
    }

    public record ReleaseTarget(
            UUID regionId,
            UUID variantId
    ) {
    }

    public record VariantSnapshot(
            UUID rulesetId,
            long ordinal,
            String status
    ) {
    }

    public void lockActiveRegion(UUID regionId) {
        regions.lockActiveById(regionId).orElseThrow(PatchReleaseStore::notFound);
    }

    public Region lockRegion(UUID regionId) {
        return regions.lockById(regionId).orElseThrow(PatchReleaseStore::notFound);
    }

    public PatchVariant lockVariantWithinRuleset(UUID variantId) {
        var beforeLock = snapshot(variantId);
        lockRuleset(beforeLock.rulesetId());
        return variants.lockById(variantId).orElseThrow(PatchReleaseStore::notFound);
    }

    public VariantSnapshot lockAndReadVariant(UUID variantId) {
        variants.lockById(variantId).orElseThrow(PatchReleaseStore::notFound);
        return snapshot(variantId);
    }

    public ReleaseTarget releaseTarget(UUID releaseId) {
        var target = releases.targetById(releaseId).orElseThrow(PatchReleaseStore::notFound);
        return new ReleaseTarget(target.getRegionId(), target.getVariantId());
    }

    public VariantSnapshot readVariantAfterLockingRuleset(UUID variantId) {
        var beforeLock = snapshot(variantId);
        lockRuleset(beforeLock.rulesetId());
        // Scalar projections bypass managed entities that may predate a concurrent ordinal insertion.
        return snapshot(variantId);
    }

    public PatchRelease lockRelease(UUID releaseId) {
        return releases.lockById(releaseId).orElseThrow(PatchReleaseStore::notFound);
    }

    public boolean regionUsesRulesetAt(UUID regionId, UUID rulesetId, Instant effectiveAt) {
        return assignments.appliesAt(regionId, rulesetId, effectiveAt);
    }

    public boolean contradictsTimeline(UUID regionId, VariantSnapshot variant, Instant effectiveAt) {
        return releases.contradictsTimeline(regionId, variant.rulesetId(), effectiveAt, variant.ordinal());
    }

    public void insert(PatchRelease release) {
        try {
            releases.saveAndFlush(release);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The patch operation conflicts with existing data.");
        }
    }

    private void lockRuleset(UUID rulesetId) {
        rulesets.lockById(rulesetId).orElseThrow(PatchReleaseStore::notFound);
    }

    private VariantSnapshot snapshot(UUID variantId) {
        var value = variants.snapshotById(variantId).orElseThrow(PatchReleaseStore::notFound);
        return new VariantSnapshot(value.getRulesetId(), value.getOrdinal(), value.getStatus());
    }

    private static ApiException notFound() {
        return new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "Patch resource does not exist.");
    }
}
