package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning.View;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;

@Tag(name = "competitions")
public interface CompetitionPlanningApi {
    record Save(
            Long version,
            CompetitionPlan content
    ) {
    }

    record Version(
            Long version
    ) {
    }

    record Preview(
            CompetitionPlan content,
            String stageCode,
            int opponent
    ) {
    }

    @Operation(operationId = "competitionPlanningApi_list", summary = "List published competitions")
    PageSlice<View> list(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size, UUID teamId, UUID playerId,
            UUID organizerPageId, UUID circuitPageId, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_summaries", summary = "List competition plans for editors")
    PageSlice<CompetitionPlanning.Summary> summaries(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            UUID organizerPageId, UUID circuitPageId, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_published", summary = "Read a published competition")
    View published(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_read", summary = "Read a competition plan draft")
    View read(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_save", summary = "Save a competition plan draft")
    View save(UUID id, Save body);

    @Operation(operationId = "competitionPlanningApi_preview", summary = "Preview generated matches of a stage")
    List<CompetitionPlan.Match> preview(Preview body);

    @Operation(operationId = "competitionPlanningApi_materialize", summary = "Create the series of decided matches")
    View materialize(UUID id, Version body);

    @Operation(operationId = "competitionPlanningApi_publish", summary = "Publish a competition")
    View publish(UUID id, Version body);

    @Operation(operationId = "competitionPlanningApi_withdraw", summary = "Withdraw a competition")
    View withdraw(UUID id, Version body);
}
