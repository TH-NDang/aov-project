package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.PatchCommands.Assignment;
import com.wikiaov.patch.internal.application.PatchCommands.CreateRegion;
import com.wikiaov.patch.internal.application.PatchCommands.Patch;
import com.wikiaov.patch.internal.application.PatchCommands.Release;
import com.wikiaov.patch.internal.application.PatchCommands.ReleasePlan;
import com.wikiaov.patch.internal.application.PatchCommands.Ruleset;
import com.wikiaov.patch.internal.application.PatchCommands.SeasonPatch;
import com.wikiaov.patch.internal.application.PatchCommands.Title;
import com.wikiaov.patch.internal.application.PatchCommands.Variant;
import com.wikiaov.patch.internal.application.PatchCommands.VariantSeason;
import com.wikiaov.patch.internal.application.response.PatchAdminViews;
import com.wikiaov.platform.CreatedId;
import com.wikiaov.platform.PageLimits;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.List;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "patch admin")
public interface PatchAdminApi {

    @Operation(operationId = "patchAdminApi_catalog", summary = "Catalog - patch admin", description = "Catalog for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<PatchAdminViews.Patch> catalog(
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchAdminApi_assignments", summary = "Assignments - patch admin", description = "Assignments for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<PatchAdminViews.Assignment> assignments(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchAdminApi_region", summary = "Region - patch admin", description = "Region for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('region:admin').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId region(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateRegion body);

    @Operation(operationId = "patchAdminApi_ruleset", summary = "Ruleset - patch admin", description = "Ruleset for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('region:admin').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId ruleset(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Ruleset body);

    @Operation(operationId = "patchAdminApi_rulesets", summary = "Rulesets - patch admin", description = "Rulesets for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<PatchAdminViews.Ruleset> rulesets(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchAdminApi_assignment", summary = "Assignment - patch admin", description = "Assignment for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('region:admin').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId assignment(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Assignment body);

    @Operation(operationId = "patchAdminApi_patch", summary = "Patch - patch admin", description = "Patch for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId patch(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Patch body);

    @Operation(operationId = "patchAdminApi_title", summary = "Title - patch admin", description = "Renames a patch in one locale and adds that locale's text when it is missing. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation; no response body.", content = @Content)
    })
    void title(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Title body);

    @Operation(operationId = "patchAdminApi_seasonPatch", summary = "Season patch - patch admin", description = "Season patch for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId seasonPatch(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SeasonPatch body);

    @Operation(operationId = "patchAdminApi_variant", summary = "Variant - patch admin", description = "Variant for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId variant(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Variant body);

    @Operation(operationId = "patchAdminApi_publish", summary = "Publish - patch admin", description = "Publish for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation; no response body.", content = @Content)
    })
    void publish(@Parameter(description = "Id identifier.") UUID id);

    @Operation(operationId = "patchAdminApi_season", summary = "Season - patch admin", description = "Puts an existing unseasoned patch variant into a season without moving it in the ruleset. The season order of the ruleset's patches must stay intact and every release must fit the season's market schedule; releases without a season join it. Repeating the same season is a no-op; another season answers 409. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write') and hasAuthority('patch:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation; no response body.", content = @Content)
    })
    void season(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid VariantSeason body);

    @Operation(operationId = "patchAdminApi_confirm", summary = "Confirm - patch admin", description = "Confirm for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation; no response body.", content = @Content)
    })
    void confirm(@Parameter(description = "Id identifier.") UUID id);

    @Operation(operationId = "patchAdminApi_release", summary = "Release - patch admin", description = "Release for patch admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId release(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Release body);

    @Operation(operationId = "patchAdminApi_releases", summary = "Replace releases - patch admin", description = "Replaces every market's release of a patch variant. Each row gives a market and exactly one of an exact moment (effectiveAt) or a calendar day of that market (effectiveOn); a market left out loses its release. Unchanged rows keep their confirmation; a moved day waits for confirmation again. Closed markets may record exact moments. Season windows and the ruleset order of each market are checked as for one release. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation; no response body.", content = @Content)
    })
    void releases(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid ReleasePlan body);
}
