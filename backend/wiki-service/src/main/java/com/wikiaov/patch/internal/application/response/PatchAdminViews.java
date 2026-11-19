package com.wikiaov.patch.internal.application.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.wikiaov.patch.internal.domain.PatchLifecycleState;
import com.wikiaov.patch.internal.domain.PatchReleaseStatus;
import com.wikiaov.patch.internal.domain.PatchStatus;
import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the admin patch catalog answers: rulesets, their market assignments and patches with variants and releases. */
public final class PatchAdminViews {
    private PatchAdminViews() {
    }

    public record Ruleset(
            UUID id,
            String code,
            @Nullable String description,
            @JsonProperty("lifecycle_state") PatchLifecycleState lifecycleState
    ) {
    }

    public record Assignment(
            UUID id,
            UUID rulesetId,
            @Nullable String validFrom,
            @Nullable String validTo
    ) {
    }

    public record Patch(
            UUID id,
            String code,
            PatchStatus status,
            long sequence,
            List<Variant> variants
    ) {
    }

    public record Variant(
            UUID id,
            UUID rulesetId,
            String variantCode,
            long rulesetOrdinal,
            PatchVariantStatus status,
            List<Release> releases
    ) {
    }

    public record Release(
            UUID id,
            UUID regionId,
            @Nullable String effectiveAt,
            @Nullable String sourceUrl,
            PatchReleaseStatus status
    ) {
    }
}
