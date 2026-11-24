package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionParticipants;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionParticipants.Participant;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning;
import com.wikiaov.community.tournament.internal.planning.application.CompetitionPlanning.View;
import com.wikiaov.community.tournament.internal.planning.domain.CompetitionPlan;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

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
            int opponent,
            @Nullable Integer teams,
            @Nullable Boolean thirdPlace
    ) {
    }

    @Operation(operationId = "competitionPlanningApi_list", summary = "List published competitions")
    PageSlice<View> list(@Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size, UUID teamId, UUID playerId,
            UUID personPageId, UUID organizerPageId, UUID circuitPageId, CompetitionPlanning.Detail detail,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_participants", summary = "List who takes part in published competitions")
    PageSlice<Participant> participants(CompetitionParticipants.Kind kind, @Size(max = 100) String q, String country,
            @Min(0) int page, @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_index", summary = "List every competition plan in short")
    List<CompetitionPlanning.IndexEntry> index(@Parameter(hidden = true) HttpServletRequest request);

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

    @Operation(operationId = "competitionPlanningApi_revisions", summary = "List the history of a competition plan")
    PageSlice<CompetitionPlanning.Revision> revisions(UUID id, @Min(0) int page,
            @Min(1) @Max(PageLimits.MAX_SIZE) int size, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_revision", summary = "Read a competition plan of the past")
    CompetitionPlan revision(UUID id, UUID revisionId, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "competitionPlanningApi_materialize", summary = "Create the series of decided matches")
    View materialize(UUID id, Version body);

    @Operation(operationId = "competitionPlanningApi_publish", summary = "Publish a competition")
    View publish(UUID id, Version body);

    @Operation(operationId = "competitionPlanningApi_withdraw", summary = "Withdraw a competition")
    View withdraw(UUID id, Version body);
}
