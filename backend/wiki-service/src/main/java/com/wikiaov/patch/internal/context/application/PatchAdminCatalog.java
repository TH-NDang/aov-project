package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.authoring.persistence.GamePatchRepository;
import com.wikiaov.patch.internal.authoring.persistence.PatchVariantRepository;
import com.wikiaov.patch.internal.authoring.persistence.entity.GamePatch;
import com.wikiaov.patch.internal.authoring.persistence.entity.PatchVariant;
import com.wikiaov.patch.internal.release.persistence.PatchReleaseRepository;
import com.wikiaov.patch.internal.release.persistence.entity.PatchRelease;
import com.wikiaov.patch.internal.ruleset.persistence.GameplayRulesetRepository;
import com.wikiaov.patch.internal.ruleset.persistence.RulesetAssignmentRepository;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.PageSlice;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
public class PatchAdminCatalog {
    private final GameplayRulesetRepository rulesets;
    private final RulesetAssignmentRepository assignments;
    private final GamePatchRepository patches;
    private final PatchVariantRepository variants;
    private final PatchReleaseRepository patchReleases;

    public PatchAdminCatalog(GameplayRulesetRepository rulesets, RulesetAssignmentRepository assignments,
            GamePatchRepository patches, PatchVariantRepository variants, PatchReleaseRepository patchReleases) {
        this.rulesets = rulesets;
        this.assignments = assignments;
        this.patches = patches;
        this.variants = variants;
        this.patchReleases = patchReleases;
    }

    public List<Map<String, Object>> rulesets() {
        return rulesets.findAllByOrderByCodeAsc().stream().map(value -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", value.getId());
            row.put("code", value.getCode());
            row.put("description", value.getDescription());
            row.put("lifecycle_state", value.getLifecycleState());
            return row;
        }).toList();
    }

    public PageSlice<Map<String, Object>> catalog(int page, int size) {
        if (page < 0 || size < 1 || size > 100)
            throw invalid("Invalid page bounds.");
        var items = patches.findAllByOrderBySequenceDesc(PageRequest.of(page, size)).stream()
                .map(this::patchRow).toList();
        return new PageSlice<>(items, page, size, patches.count());
    }

    public List<Map<String, Object>> assignments(UUID regionId) {
        return assignments.findByRegionIdOrderByValidFromDesc(regionId).stream().map(value -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", value.getId());
            row.put("rulesetId", value.getRulesetId());
            row.put("validFrom", AdminTimestamp.format(value.getValidFrom()));
            row.put("validTo", AdminTimestamp.format(value.getValidTo()));
            return row;
        }).toList();
    }

    private Map<String, Object> patchRow(GamePatch patch) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", patch.getId());
        row.put("code", patch.getCode());
        row.put("status", patch.getStatus());
        row.put("sequence", patch.getSequence());
        row.put("variants", variants.findByPatchIdOrderByRulesetOrdinalAsc(patch.getId()).stream()
                .map(this::variantRow).toList());
        return row;
    }

    private Map<String, Object> variantRow(PatchVariant variant) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", variant.getId());
        row.put("rulesetId", variant.getRulesetId());
        row.put("variantCode", variant.getVariantCode());
        row.put("rulesetOrdinal", variant.getRulesetOrdinal());
        row.put("status", variant.getStatus());
        row.put("releases", patchReleases.findByPatchVariantIdOrderByEffectiveAtAsc(variant.getId()).stream()
                .map(this::releaseRow).toList());
        return row;
    }

    private Map<String, Object> releaseRow(PatchRelease release) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("id", release.getId());
        row.put("regionId", release.getRegionId());
        row.put("effectiveAt", AdminTimestamp.format(release.getEffectiveAt()));
        row.put("sourceUrl", release.getSourceUrl());
        row.put("status", release.getStatus());
        return row;
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }
}
