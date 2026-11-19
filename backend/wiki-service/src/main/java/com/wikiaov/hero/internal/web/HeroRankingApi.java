package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroRankingCommands.ConfirmSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ImportSnapshot;
import com.wikiaov.hero.internal.application.HeroRankingCommands.ReviewValue;
import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero admin")
public interface HeroRankingApi {
    @Operation(operationId = "heroRankingApi_list", summary = "List ranking snapshots", description = "Captures of the game's hero ranking boards, newest first, with how many values still wait for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<HeroRankingViews.Summary> list(@Parameter(description = "Market code.") String region,
            @Parameter(description = "Mode code, e.g. RANKED_ELITE.") String mode,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 20.") @Min(1) @Max(100) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroRankingApi_import", summary = "Import a ranking snapshot", description = "Stores a snapshot read from screenshots, with every value's source area and review flag. Heroes are named by code. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Created.", useReturnTypeSchema = true)
    })
    HeroRankingViews.Detail importSnapshot(@Valid ImportSnapshot body);

    @Operation(operationId = "heroRankingApi_detail", summary = "Read a ranking snapshot", description = "Every hero of the snapshot with its values, where each was read and whether it waits for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRankingViews.Detail detail(@Parameter(description = "Snapshot identifier.") UUID snapshotId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroRankingApi_review", summary = "Review one ranking value", description = "Confirms, corrects or flags one value. Flagging a value of a confirmed snapshot reopens the snapshot. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRankingViews.Reviewed review(@Parameter(description = "Snapshot identifier.") UUID snapshotId,
            @Parameter(description = "Hero or hero form identifier.") UUID heroId,
            @Parameter(description = "Metric, e.g. WIN_RATE.") String metric, @Valid ReviewValue body);

    @Operation(operationId = "heroRankingApi_confirm", summary = "Confirm a ranking snapshot", description = "Signs off the whole snapshot once no value waits for review. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRankingViews.Summary confirm(@Parameter(description = "Snapshot identifier.") UUID snapshotId,
            @Valid ConfirmSnapshot body);

    @Operation(operationId = "heroRankingApi_delete", summary = "Delete a ranking snapshot", description = "For a snapshot imported by mistake; removes its images, heroes and values. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void delete(@Parameter(description = "Snapshot identifier.") UUID snapshotId,
            @Parameter(description = "Snapshot version the caller saw.") @Positive long expectedVersion);
}
