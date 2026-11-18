package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinBadgeCommands;
import com.wikiaov.hero.internal.application.response.HeroMediaGroup;
import com.wikiaov.hero.internal.application.response.SkinBadgeRelation;
import com.wikiaov.hero.internal.application.response.SkinBadgeView;
import com.wikiaov.hero.internal.domain.HeroContent.MediaRole;
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
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero media")
public interface HeroMediaApi {

    @Operation(operationId = "heroMediaApi_gallery", summary = "Gallery - hero media", description = "Gallery for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<HeroMediaGroup> gallery(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Media binding role filter (head, portrait or splash), not a gameplay role.") MediaRole role,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroMediaApi_badges", summary = "Badges - hero media", description = "Badges for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SkinBadgeView> badges(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Group id identifier.") UUID groupId,
            @Parameter(description = "Ungrouped.") boolean ungrouped,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroMediaApi_create", summary = "Create - hero media", description = "Create for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    SkinBadgeView create(
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SkinBadgeCommands.Create body);

    @Operation(operationId = "heroMediaApi_update", summary = "Update - hero media", description = "Update for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SkinBadgeView update(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SkinBadgeCommands.Update body);

    @Operation(operationId = "heroMediaApi_assignGroup", summary = "Assign group - hero media", description = "Assign group for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SkinBadgeView assignGroup(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SkinBadgeCommands.AssignGroup body);

    @Operation(operationId = "heroMediaApi_skins", summary = "Skins - hero media", description = "Skins for hero media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SkinBadgeRelation> skins(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
