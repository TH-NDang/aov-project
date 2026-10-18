package com.wikiaov.patch.internal.application.service;

import com.wikiaov.patch.*;
import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.RegionErrorCode;
import com.wikiaov.patch.internal.persistence.PatchStore;
import com.wikiaov.patch.internal.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.persistence.RankedSeasonRepository;
import com.wikiaov.patch.internal.persistence.entity.PatchVariant;
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
    private final PatchVariantRepository variants;
    private final RankedSeasonRepository seasons;
    public ResolveGameplayContext(PatchStore store, PatchVariantRepository variants, RankedSeasonRepository seasons) {
        this.store = store;
        this.variants = variants;
        this.seasons = seasons;
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
        return variantView(variants.findById(variantId).orElseThrow(
                () -> new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The patch variant does not exist.")));
    }

    public List<PatchVariantReference> catalogVariants(UUID seasonId) {
        if (seasonId != null && !seasons.existsById(seasonId))
            throw new ApiException(PatchErrorCode.PATCH_NOT_FOUND, "The season does not exist.");
        return (seasonId == null ? variants.findAll() : variants.findBySeasonId(seasonId)).stream()
                .map(this::variantView).toList();
    }

    private PatchVariantReference variantView(PatchVariant variant) {
        return new PatchVariantReference(variant.getId(), variant.getPatchId(), variant.getRulesetId(),
                variant.getSeasonId(), variant.getRulesetOrdinal(), "PUBLISHED".equals(variant.getStatus()));
    }

    private static UUID id(Map<String, Object> row, String key) {
        return (UUID) row.get(key);
    }

    private static final String AUTHORING = """
            SELECT rel.id release_id,r.id region_id,r.code region_code,s.id season_id,s.display_name,
              v.ruleset_id,v.id variant_id,p.code patch_code,v.ruleset_ordinal,rel.effective_at
            FROM patch.patch_release rel
            JOIN patch.region r ON r.id=rel.region_id AND r.lifecycle_state='ACTIVE'
            JOIN patch.season_schedule schedule ON schedule.region_id=r.id
              AND rel.effective_at>=schedule.starts_at AND rel.effective_at<schedule.ends_at
              AND (rel.season_id IS NULL OR rel.season_id=schedule.season_id)
            JOIN patch.ranked_season s ON s.id=schedule.season_id
            JOIN patch.patch_variant v ON v.id=rel.patch_variant_id AND v.status='PUBLISHED'
            JOIN patch.game_patch p ON p.id=v.patch_id AND p.status='PUBLISHED'
            JOIN patch.gameplay_ruleset rs ON rs.id=v.ruleset_id AND rs.lifecycle_state='ACTIVE'
            WHERE rel.status='SCHEDULED'
            """;

    private static final String SHARED_AUTHORING = """
            SELECT v.id,v.ruleset_id,v.ruleset_ordinal,p.code patch_code,s.id season_id,s.display_name
            FROM patch.patch_variant v JOIN patch.game_patch p ON p.id=v.patch_id
            JOIN patch.ranked_season s ON s.id=v.season_id
            JOIN patch.gameplay_ruleset rs ON rs.id=v.ruleset_id AND rs.lifecycle_state='ACTIVE'
            WHERE v.status IN ('DRAFT','PUBLISHED')
            """;
    public List<AuthoringContext> authoring(UUID regionId, UUID seasonId) {
        if (regionId != null)
            return store.rows(AUTHORING + " AND r.id=? AND s.id=? ORDER BY rel.effective_at", regionId, seasonId)
                    .stream().map(this::authoringView).toList();
        return store.rows(SHARED_AUTHORING + " AND s.id=? ORDER BY v.ruleset_ordinal", seasonId)
                .stream().map(this::sharedView).toList();
    }
    public AuthoringContext authoringContext(UUID contextId) {
        var shared = store.rows(SHARED_AUTHORING + " AND v.id=?", contextId);
        if (!shared.isEmpty())
            return sharedView(shared.getFirst());
        // Keep accepted jobs using legacy release IDs executable after migration.
        return store.rows(AUTHORING + " AND rel.id=?", contextId).stream().map(this::authoringView).findFirst()
                .orElseThrow(() -> new ApiException(PatchErrorCode.PATCH_CONTEXT_UNAVAILABLE,
                        "Choose a patch within a known season."));
    }
    private AuthoringContext sharedView(Map<String, Object> r) {
        return new AuthoringContext(id(r, "id"), null, null, id(r, "season_id"), (String) r.get("display_name"),
                id(r, "ruleset_id"), id(r, "id"), (String) r.get("patch_code"),
                ((Number) r.get("ruleset_ordinal")).longValue(), null);
    }

    private AuthoringContext authoringView(Map<String, Object> r) {
        return new AuthoringContext(id(r, "release_id"), id(r, "region_id"), (String) r.get("region_code"),
                id(r, "season_id"), (String) r.get("display_name"), id(r, "ruleset_id"), id(r, "variant_id"),
                (String) r.get("patch_code"), ((Number) r.get("ruleset_ordinal")).longValue(),
                ((Timestamp) r.get("effective_at")).toInstant());
    }
}
