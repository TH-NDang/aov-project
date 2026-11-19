package com.wikiaov.patch.internal.application.response;

import com.wikiaov.patch.internal.domain.PatchDataReviewState;
import com.wikiaov.patch.internal.domain.PatchReleaseStatus;
import com.wikiaov.patch.internal.domain.PatchVariantStatus;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public final class PublicationOverviewView {
    private PublicationOverviewView() {
    }

    public record Market(
            UUID id,
            String code,
            String displayName,
            boolean available,
            UUID currentRulesetId,
            UUID currentSeasonId,
            UUID currentReleaseId
    ) {
    }

    public record RulesetView(
            UUID id,
            String code,
            String description
    ) {
    }

    public record AssignmentView(
            UUID id,
            UUID regionId,
            UUID rulesetId,
            Instant validFrom,
            Instant validTo
    ) {
    }

    public record SeasonView(
            UUID id,
            String code,
            String displayName,
            long ordinal
    ) {
    }

    public record SeasonScheduleView(
            UUID id,
            UUID seasonId,
            UUID regionId,
            Instant startsAt,
            Instant endsAt,
            LocalDate startsOn,
            LocalDate endsOn,
            String phase
    ) {
    }

    public record VariantView(
            UUID id,
            UUID patchId,
            String patchCode,
            String patchTitle,
            UUID rulesetId,
            long rulesetOrdinal,
            UUID seasonId,
            PatchVariantStatus status,
            PatchDataReviewState dataReviewState,
            long dataReviewVersion,
            Instant dataReviewedAt
    ) {
    }

    public record ReleaseView(
            UUID id,
            UUID variantId,
            UUID regionId,
            UUID seasonId,
            Instant effectiveAt,
            LocalDate effectiveOn,
            Instant confirmedAt,
            String sourceUrl,
            PatchReleaseStatus status,
            String phase
    ) {
    }

    public record Snapshot(
            Instant asOf,
            List<Market> markets,
            List<RulesetView> rulesets,
            List<AssignmentView> assignments,
            List<SeasonView> seasons,
            List<SeasonScheduleView> seasonSchedules,
            List<VariantView> variants,
            List<ReleaseView> releases
    ) {
    }

}
