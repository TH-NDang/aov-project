package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroCommands.BaselineContext;
import com.wikiaov.hero.internal.application.HeroCommands.Create;
import com.wikiaov.hero.internal.application.HeroCommands.Fork;
import com.wikiaov.hero.internal.application.HeroCommands.Mutation;
import com.wikiaov.hero.internal.application.response.HeroCatalogView;
import com.wikiaov.hero.internal.application.response.HeroComparisonView;
import com.wikiaov.hero.internal.application.response.HeroDraftChangesView;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import com.wikiaov.hero.internal.application.response.HeroStatusView;
import com.wikiaov.hero.internal.authoring.application.HeroRevisionRead;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.BindingsRequest;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.ProfileRequest;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.RatingsRequest;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.SkillsRequest;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.SkinsRequest;
import com.wikiaov.hero.internal.web.request.HeroSectionRequests.StatsRequest;
import com.wikiaov.platform.PageLimits;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
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
@Tag(name = "hero admin")
public interface HeroAdminApi {

    @Operation(operationId = "heroAdminApi_list", summary = "List - hero admin", description = "List for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<HeroCatalogView> list(@Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Season id identifier.") UUID seasonId,
            @Parameter(description = "Patch variant id identifier.") UUID patchVariantId,
            @Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Sort expression accepted by this endpoint.") String sort,
            @Parameter(description = "Include entries that have no changes in the selected context.") boolean includeUnchanged,
            @Parameter(description = "Comma-separated role codes; matches any selected role.") String role,
            @Parameter(description = "Comma-separated captured positions: top, mid, rung, rong-ad, tro-thu.") String position,
            @Parameter(description = "Filter the selected snapshot by unresolved source warnings.") Boolean hasWarnings,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_status", summary = "Status - hero admin", description = "Status for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroStatusView status(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_create", summary = "Create - hero admin", description = "Create for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    HeroRevisionView create(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Create body);

    @Operation(operationId = "heroAdminApi_fork", summary = "Fork - hero admin", description = "Fork for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    HeroRevisionView fork(@Parameter(description = "Hero id identifier.") UUID heroId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Fork body);

    @Operation(operationId = "heroAdminApi_revisions", summary = "Revisions - hero admin", description = "Revisions for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<HeroRevisionView> revisions(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_read", summary = "Read - hero admin", description = "One revision of a hero with the stored content of each section it holds. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionRead read(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_comparison", summary = "Comparison - hero admin", description = "Comparison for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroComparisonView comparison(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @Parameter(description = "From revision id identifier.") UUID fromRevisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_draftChanges", summary = "Draft changes - hero admin", description = "What a draft has changed so far, compared with its source revision or its own first content. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroDraftChangesView draftChanges(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroAdminApi_publish", summary = "Publish - hero admin", description = "Publish for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView publish(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation body);

    @Operation(operationId = "heroAdminApi_baselineContext", summary = "Baseline context - hero admin", description = "Baseline context for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView baselineContext(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid BaselineContext body);

    @Operation(operationId = "heroAdminApi_discard", summary = "Discard - hero admin", description = "Discard for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView discard(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation body);

    @Operation(operationId = "heroAdminApi_updateProfile", summary = "Update profile - hero admin", description = "Update profile for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateProfile(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid ProfileRequest body);

    @Operation(operationId = "heroAdminApi_updateRatings", summary = "Update ratings - hero admin", description = "Update ratings for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateRatings(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid RatingsRequest body);

    @Operation(operationId = "heroAdminApi_updateStats", summary = "Update stats - hero admin", description = "Update stats for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateStats(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid StatsRequest body);

    @Operation(operationId = "heroAdminApi_updateSkills", summary = "Update skills - hero admin", description = "Update skills for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateSkills(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SkillsRequest body);

    @Operation(operationId = "heroAdminApi_updateSkins", summary = "Update skins - hero admin", description = "Update skins for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateSkins(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SkinsRequest body);

    @Operation(operationId = "heroAdminApi_updateBindings", summary = "Update bindings - hero admin", description = "Update bindings for hero admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroRevisionView updateBindings(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Draft id identifier.") UUID draftId,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid BindingsRequest body);
}
