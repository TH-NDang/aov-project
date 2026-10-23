package com.wikiaov.patch.internal.authoring.application;

import com.wikiaov.patch.internal.application.PatchCommands.*;
import com.wikiaov.patch.internal.context.application.PatchAdminCatalog;
import com.wikiaov.patch.internal.release.application.PatchReleaseWorkflow;
import com.wikiaov.patch.internal.ruleset.application.RulesetAdministration;
import com.wikiaov.platform.PageSlice;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Authorization and transaction boundary for game configuration administration. */
@Service
@Transactional
public class PatchAuthoring {
    private final RulesetAdministration rulesets;
    private final PatchDrafts drafts;
    private final PatchAdminCatalog catalog;
    private final PatchReleaseWorkflow releases;

    public PatchAuthoring(RulesetAdministration rulesets, PatchDrafts drafts,
            PatchAdminCatalog catalog, PatchReleaseWorkflow releases) {
        this.rulesets = rulesets;
        this.drafts = drafts;
        this.catalog = catalog;
        this.releases = releases;
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID region(CreateRegion input) {
        return rulesets.region(input);
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID ruleset(Ruleset input) {
        return rulesets.ruleset(input);
    }

    @PreAuthorize("hasAuthority('region:admin')")
    public UUID assign(UUID regionId, Assignment input) {
        return rulesets.assign(regionId, input);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public UUID patch(Patch input) {
        return drafts.patch(input);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public UUID variant(UUID patchId, Variant input) {
        return drafts.variant(patchId, input);
    }

    @PreAuthorize("hasAuthority('patch:write')")
    public UUID seasonPatch(SeasonPatch input) {
        return drafts.seasonPatch(input);
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public void publish(UUID variantId) {
        drafts.publish(variantId);
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public UUID release(UUID variantId, Release input) {
        return releases.schedule(variantId, input);
    }

    @PreAuthorize("hasAuthority('patch:publish')")
    public void confirmRelease(UUID releaseId) {
        releases.confirm(releaseId);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> rulesets() {
        return catalog.rulesets();
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public PageSlice<Map<String, Object>> catalog(int page, int size) {
        return catalog.catalog(page, size);
    }

    @PreAuthorize("hasAuthority('catalog:read')")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> assignments(UUID regionId) {
        return catalog.assignments(regionId);
    }
}
