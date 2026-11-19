package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.season.application.RankedSeasons;
import com.wikiaov.platform.CreatedId;
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
@Tag(name = "ranked season")
public interface RankedSeasonApi {

    @Operation(operationId = "rankedSeasonApi_list", summary = "List - ranked season", description = "List for ranked season. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<RankedSeasons.View> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "rankedSeasonApi_create", summary = "Create - ranked season", description = "Create for ranked season. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    RankedSeasons.View create(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid RankedSeasons.Input input);

    @Operation(operationId = "rankedSeasonApi_schedule", summary = "Schedule - ranked season", description = "Schedule for ranked season. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId schedule(@Parameter(description = "Season id identifier.") UUID seasonId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid RankedSeasons.ScheduleInput input);
}
