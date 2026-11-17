package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateGuideDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateGuide;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Visibility;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminGuide;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminLineup;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.platform.PageLimits;
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
import jakarta.validation.constraints.Pattern;
import java.util.List;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "auto chess admin")
public interface AutoChessAdminApi {

    @Operation(operationId = "autoChessAdminApi_current", summary = "Current - auto chess admin", description = "Current for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminGuide current(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "autoChessAdminApi_history", summary = "History - auto chess admin", description = "History for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<Revision> history(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "autoChessAdminApi_revision", summary = "Revision - auto chess admin", description = "Revision for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminGuide revision(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "autoChessAdminApi_createDraft", summary = "Create draft - auto chess admin", description = "Create draft for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    AdminGuide createDraft(@Parameter(description = "Game mode id.") UUID modeId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateGuideDraft input);

    @Operation(operationId = "autoChessAdminApi_update", summary = "Update - auto chess admin", description = "Update for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminGuide update(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid UpdateGuide input);

    @Operation(operationId = "autoChessAdminApi_publish", summary = "Publish - auto chess admin", description = "Publish for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminGuide publish(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "autoChessAdminApi_discard", summary = "Discard - auto chess admin", description = "Discard for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminGuide discard(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "autoChessAdminApi_communityLineups", summary = "Community lineups - auto chess admin", description = "Community lineups for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<AdminLineup> communityLineups(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Optional lineup status filter: VISIBLE or HIDDEN.") @Pattern(regexp = "VISIBLE|HIDDEN") String status,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "autoChessAdminApi_visibility", summary = "Visibility - auto chess admin", description = "Visibility for auto chess admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminLineup visibility(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Lineup id.") UUID lineupId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Visibility input);
}
