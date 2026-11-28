package com.wikiaov.gamemode.internal.web;

import com.wikiaov.gamemode.internal.application.GameModeCommands.Mutation;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.AdminMap;
import com.wikiaov.gamemode.internal.application.response.GameModeViews.Revision;
import com.wikiaov.gamemode.internal.mapguide.application.CreateMapDraftCommand;
import com.wikiaov.gamemode.internal.mapguide.application.UpdateMapCommand;
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
@Tag(name = "map guide admin")
public interface MapGuideAdminApi {

    @Operation(operationId = "mapGuideAdminApi_current", summary = "Current - map guide admin", description = "Current for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMap current(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "mapGuideAdminApi_history", summary = "History - map guide admin", description = "History for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<Revision> history(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "mapGuideAdminApi_revision", summary = "Revision - map guide admin", description = "Revision for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMap revision(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "mapGuideAdminApi_createDraft", summary = "Create draft - map guide admin", description = "Create draft for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    AdminMap createDraft(@Parameter(description = "Game mode id.") UUID modeId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateMapDraftCommand input);

    @Operation(operationId = "mapGuideAdminApi_update", summary = "Update - map guide admin", description = "Update for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMap update(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid UpdateMapCommand input);

    @Operation(operationId = "mapGuideAdminApi_publish", summary = "Publish - map guide admin", description = "Publish for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMap publish(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "mapGuideAdminApi_discard", summary = "Discard - map guide admin", description = "Discard for map guide admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('gamemode:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    AdminMap discard(@Parameter(description = "Game mode id.") UUID modeId,
            @Parameter(description = "Revision id.") UUID revisionId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);
}
