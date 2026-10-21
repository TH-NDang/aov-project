package com.wikiaov.patch.internal.persistence;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.persistence.entity.Region;
import com.wikiaov.platform.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

/** Persistence operations for the region's release timeline, sharing the caller's transaction. */
@Repository
public class PatchReleaseStore {
    private final PatchStore store;

    public PatchReleaseStore(PatchStore store) {
        this.store = store;
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
        store.one("SELECT id FROM patch.region WHERE id=? AND lifecycle_state='ACTIVE' FOR UPDATE", regionId);
    }

    public Region lockRegion(UUID regionId) {
        return store.lock(Region.class, regionId);
    }

    public PatchVariant lockVariantWithinRuleset(UUID variantId) {
        UUID rulesetId = (UUID) store.one("SELECT ruleset_id FROM patch.patch_variant WHERE id=?", variantId)
                .get("ruleset_id");
        store.lockRuleset(rulesetId);
        return store.lock(PatchVariant.class, variantId);
    }

    public VariantSnapshot lockAndReadVariant(UUID variantId) {
        return variantSnapshot(store.one("SELECT * FROM patch.patch_variant WHERE id=? FOR UPDATE", variantId));
    }

    public ReleaseTarget releaseTarget(UUID releaseId) {
        var row = store.one("SELECT * FROM patch.patch_release WHERE id=?", releaseId);
        return new ReleaseTarget((UUID) row.get("region_id"), (UUID) row.get("patch_variant_id"));
    }

    public VariantSnapshot readVariantAfterLockingRuleset(UUID variantId) {
        var beforeLock = store.one("SELECT * FROM patch.patch_variant WHERE id=?", variantId);
        store.lockRuleset((UUID) beforeLock.get("ruleset_id"));
        // An insertion can renumber variants while we wait for the ruleset lock.
        return variantSnapshot(store.one("SELECT * FROM patch.patch_variant WHERE id=?", variantId));
    }

    public PatchRelease lockRelease(UUID releaseId) {
        return store.lock(PatchRelease.class, releaseId);
    }

    public boolean regionUsesRulesetAt(UUID regionId, UUID rulesetId, Instant effectiveAt) {
        var time = Timestamp.from(effectiveAt);
        return !store.rows("""
                SELECT id FROM patch.region_ruleset_assignment
                WHERE region_id=? AND ruleset_id=? AND valid_from<=? AND (valid_to IS NULL OR valid_to>?)
                """, regionId, rulesetId, time, time).isEmpty();
    }

    public boolean contradictsTimeline(UUID regionId, VariantSnapshot variant, Instant effectiveAt) {
        var time = Timestamp.from(effectiveAt);
        return !store.rows("""
                SELECT rel.id FROM patch.patch_release rel JOIN patch.patch_variant v ON v.id=rel.patch_variant_id
                WHERE rel.region_id=? AND rel.status='SCHEDULED' AND v.ruleset_id=?
                AND ((rel.effective_at<=? AND v.ruleset_ordinal>=?) OR (rel.effective_at>=? AND v.ruleset_ordinal<=?))
                """, regionId, variant.rulesetId(), time, variant.ordinal(), time, variant.ordinal()).isEmpty();
    }

    public void insert(PatchRelease release) {
        try {
            store.insert(release);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(PatchErrorCode.PATCH_CONFLICT, "The patch operation conflicts with existing data.");
        }
    }

    private static VariantSnapshot variantSnapshot(Map<String, Object> row) {
        return new VariantSnapshot((UUID) row.get("ruleset_id"),
                ((Number) row.get("ruleset_ordinal")).longValue(), (String) row.get("status"));
    }
}
