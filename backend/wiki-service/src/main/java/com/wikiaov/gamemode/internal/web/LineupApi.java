package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.SaveLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.LikeState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.MyState;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.OwnLineup;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "game mode lineup")
public interface LineupApi {

    @Operation(operationId = "lineupApi_me", summary = "Me - game mode lineup", description = "Me for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    MyState me(@Parameter(description = "Game mode code.") String code,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "lineupApi_like", summary = "Like - game mode lineup", description = "Like for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    LikeState like(@Parameter(description = "Game mode code.") String code,
            @Parameter(description = "Lineup id.") UUID lineupId);

    @Operation(operationId = "lineupApi_unlike", summary = "Unlike - game mode lineup", description = "Unlike for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    LikeState unlike(@Parameter(description = "Game mode code.") String code,
            @Parameter(description = "Lineup id.") UUID lineupId);

    @Operation(operationId = "lineupApi_create", summary = "Create - game mode lineup", description = "Create for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    OwnLineup create(@Parameter(description = "Game mode code.") String code,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SaveLineup input);

    @Operation(operationId = "lineupApi_update", summary = "Update - game mode lineup", description = "Update for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    OwnLineup update(@Parameter(description = "Game mode code.") String code,
            @Parameter(description = "Lineup id.") UUID lineupId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SaveLineup input);

    @Operation(operationId = "lineupApi_delete", summary = "Delete - game mode lineup", description = "Delete for game mode lineup. Requires the bearer token of a signed-in person; service accounts are refused. Abuse limits apply per person. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "204", description = "No content."),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    void delete(@Parameter(description = "Game mode code.") String code,
            @Parameter(description = "Lineup id.") UUID lineupId,
            @Parameter(description = "Optimistic version the caller last read.") long expectedVersion,
            @Parameter(hidden = true) HttpServletRequest request);
}
