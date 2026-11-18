package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateDraft;
import com.wikiaov.gamemode.internal.application.GameModeCommands.CreateMode;
import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.GameModeCommands.UpdateMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMode;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminSummary;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "game mode admin")
public interface GameModeAdminApi {

    @Operation(operationId = "gameModeAdminApi_list", summary = "List - game mode admin", description = "List for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<AdminSummary> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModeAdminApi_create", summary = "Create - game mode admin", description = "Create for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    AdminMode create(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateMode input);

    @Operation(operationId = "gameModeAdminApi_current", summary = "Current - game mode admin", description = "Current for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMode current(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModeAdminApi_history", summary = "History - game mode admin", description = "History for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<Revision> history(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModeAdminApi_revision", summary = "Revision - game mode admin", description = "Revision for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMode revision(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(description = "Revision id.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "gameModeAdminApi_createDraft", summary = "Create draft - game mode admin", description = "Create draft for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    AdminMode createDraft(@Parameter(description = "Game mode id.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateDraft input);

    @Operation(operationId = "gameModeAdminApi_update", summary = "Update - game mode admin", description = "Update for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMode update(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid UpdateMode input);

    @Operation(operationId = "gameModeAdminApi_publish", summary = "Publish - game mode admin", description = "Publish for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMode publish(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "gameModeAdminApi_discard", summary = "Discard - game mode admin", description = "Discard for game mode admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMode discard(@Parameter(description = "Game mode id.") UUID id,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);
}
