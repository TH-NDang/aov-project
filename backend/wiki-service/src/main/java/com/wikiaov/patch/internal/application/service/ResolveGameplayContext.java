package com.wikiaov.patch.internal.application.service;
import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
import com.wikiaov.platform.ApiException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service
@Transactional(readOnly = true)
public class ResolveGameplayContext implements GameplayContexts {
    private final PatchStore store;
    public ResolveGameplayContext(PatchStore store) {
        this.store = store;
    }
    public GameplayContext resolve(String region, Instant at) {
        var market = store.rows("SELECT id FROM patch.region WHERE code=? AND lifecycle_state='ACTIVE'", region);
        if (market.isEmpty())
            throw new ApiException(RegionErrorCode.UNSUPPORTED_REGION, "The requested region is unavailable.");
        var rows = store.rows("""
   SELECT r.id region_id,r.code region_code,rs.id ruleset_id,rs.code ruleset_code,
    p.id patch_id,p.code patch_code,v.id variant_id,v.ruleset_ordinal,rel.effective_at
   FROM patch.region r JOIN patch.region_ruleset_assignment a ON a.region_id=r.id
   JOIN patch.gameplay_ruleset rs ON rs.id=a.ruleset_id AND rs.lifecycle_state='ACTIVE'
   JOIN patch.patch_release rel ON rel.region_id=r.id AND rel.status='SCHEDULED' AND rel.effective_at<=?
   JOIN patch.patch_variant v ON v.id=rel.patch_variant_id AND v.ruleset_id=rs.id AND v.status='PUBLISHED'
   JOIN patch.game_patch p ON p.id=v.patch_id AND p.status='PUBLISHED'
   WHERE r.code=? AND a.valid_from<=? AND (a.valid_to IS NULL OR a.valid_to>?)
   ORDER BY rel.effective_at DESC LIMIT 1
   """, Timestamp.from(at), region, Timestamp.from(at), Timestamp.from(at));
        if (rows.isEmpty())
            throw new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                    "No verified gameplay context is available for this region and time.");
        var row = rows.getFirst();
        return new GameplayContext(id(row, "region_id"), region, id(row, "ruleset_id"),
                (String) row.get("ruleset_code"), id(row, "patch_id"), (String) row.get("patch_code"),
                id(row, "variant_id"), ((Number) row.get("ruleset_ordinal")).longValue(),
                ((Timestamp) row.get("effective_at")).toInstant());
    }
    public List<GameplayContext> active(Instant at) {
        return store.rows("SELECT code FROM patch.region WHERE lifecycle_state='ACTIVE'").stream().map(row -> {
            try {
                return resolve((String) row.get("code"), at);
            } catch (ApiException e) {
                if (e.getErrorCode() == PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE)
                    return null;
                throw e;
            }
        }).filter(java.util.Objects::nonNull).toList();
    }
    public void requireRuleset(UUID rulesetId) {
        if (store.rows("SELECT id FROM patch.gameplay_ruleset WHERE id=? AND lifecycle_state='ACTIVE'", rulesetId)
                .isEmpty())
            throw new ApiException(PatchErrorCode.PATCH_INVALID, "The ruleset is unavailable.");
    }
    public PatchVariantReference variant(UUID variantId) {
        var row = store.one("SELECT * FROM patch.patch_variant WHERE id=?", variantId);
        return new PatchVariantReference(variantId, id(row, "patch_id"), id(row, "ruleset_id"),
                ((Number) row.get("ruleset_ordinal")).longValue(), "PUBLISHED".equals(row.get("status")));
    }
    private static UUID id(Map<String, Object> row, String key) {
        return (UUID) row.get(key);
    }
}
