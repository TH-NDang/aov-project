package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.response.GameModeViews.CardList;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Insights;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.PublicMode;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "game mode public")
public interface GameModePublicApi {

    @Operation(operationId = "gameModePublicApi_list", summary = "List - game mode public", description = "List for game mode public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    CardList list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModePublicApi_read", summary = "Read - game mode public", description = "Read for game mode public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PublicMode read(@Parameter(description = "Game mode code.") String code,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModePublicApi_guide", summary = "Guide - game mode public", description = "Guide for game mode public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PublicGuide guide(@Parameter(description = "Game mode code.") String code,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModePublicApi_lineups", summary = "Lineups - game mode public", description = "Lineups for game mode public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PageSlice<PublicLineup> lineups(@Parameter(description = "Game mode code.") String code,
            @Parameter(description = "Ranking: popular, trending or recent.") String sort,
            @Parameter(description = "Optional unit code the lineup must contain.") String unit,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModePublicApi_insights", summary = "Insights - game mode public", description = "Insights for game mode public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Insights insights(@Parameter(description = "Game mode code.") String code,
            @Parameter(hidden = true) HttpServletRequest request);
}
