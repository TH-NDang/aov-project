package com.wikiaov.patch.internal.context.application;

import com.wikiaov.patch.internal.application.PatchErrorCode;
import com.wikiaov.patch.internal.application.response.PatchAdminViews;
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
import java.util.List;
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

    public List<PatchAdminViews.Ruleset> rulesets() {
        return rulesets.findAllByOrderByCodeAsc().stream().map(value -> new PatchAdminViews.Ruleset(value.getId(),
                value.getCode(), value.getDescription(), value.getLifecycleState())).toList();
    }

    public PageSlice<PatchAdminViews.Patch> catalog(int page, int size) {
        var items = patches.findAllByOrderBySequenceDesc(PageRequest.of(page, size)).stream()
                .map(this::patchView).toList();
        return new PageSlice<>(items, page, size, patches.count());
    }

    public List<PatchAdminViews.Assignment> assignments(UUID regionId) {
        return assignments.findByRegionIdOrderByValidFromDesc(regionId).stream()
                .map(value -> new PatchAdminViews.Assignment(value.getId(), value.getRulesetId(),
                        AdminTimestamp.format(value.getValidFrom()), AdminTimestamp.format(value.getValidTo())))
                .toList();
    }

    private PatchAdminViews.Patch patchView(GamePatch patch) {
        return new PatchAdminViews.Patch(patch.getId(), patch.getCode(), patch.getStatus(), patch.getSequence(),
                variants.findByPatchIdOrderByRulesetOrdinalAsc(patch.getId()).stream().map(this::variantView)
                        .toList());
    }

    private PatchAdminViews.Variant variantView(PatchVariant variant) {
        return new PatchAdminViews.Variant(variant.getId(), variant.getRulesetId(), variant.getVariantCode(),
                variant.getRulesetOrdinal(), variant.getStatus(),
                patchReleases.findByPatchVariantIdOrderByEffectiveAtAsc(variant.getId()).stream()
                        .map(PatchAdminCatalog::releaseView).toList());
    }

    private static PatchAdminViews.Release releaseView(PatchRelease release) {
        return new PatchAdminViews.Release(release.getId(), release.getRegionId(),
                AdminTimestamp.format(release.getEffectiveAt()), release.getSourceUrl(), release.getStatus());
    }

    private static ApiException invalid(String detail) {
        return new ApiException(PatchErrorCode.PATCH_INVALID, detail);
    }
}
