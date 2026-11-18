package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Create;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Fork;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Mutation;
import com.wikiaov.enchantment.internal.application.EnchantmentCommands.Update;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentView;
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
import java.util.List;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "enchantment admin")
public interface EnchantmentAdminApi {

    @Operation(operationId = "enchantmentAdminApi_list", summary = "List - enchantment admin", description = "List for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<EnchantmentView> list(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Season id identifier.") UUID seasonId,
            @Parameter(description = "Patch variant id identifier.") UUID patchVariantId,
            @Parameter(description = "Include entries that have no changes in the selected context.") boolean includeUnchanged,
            @Parameter(description = "List working drafts across patches in one ruleset.") boolean draftsOnly,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "enchantmentAdminApi_latest", summary = "Latest - enchantment admin", description = "Latest for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentView latest(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "enchantmentAdminApi_create", summary = "Create - enchantment admin", description = "Create for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    EnchantmentView create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Create input);

    @Operation(operationId = "enchantmentAdminApi_reorder", summary = "Reorder - enchantment admin", description = "Reorder for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<EnchantmentView> reorder(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid EnchantmentOrdering.Nodes input);

    @Operation(operationId = "enchantmentAdminApi_history", summary = "History - enchantment admin", description = "History for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<EnchantmentView.Revision> history(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "enchantmentAdminApi_read", summary = "Read - enchantment admin", description = "Read for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentView read(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "enchantmentAdminApi_fork", summary = "Fork - enchantment admin", description = "Fork for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    EnchantmentView fork(@Parameter(description = "Id identifier.") UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Fork input);

    @Operation(operationId = "enchantmentAdminApi_update", summary = "Update - enchantment admin", description = "Update for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentView update(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Update input);

    @Operation(operationId = "enchantmentAdminApi_publish", summary = "Publish - enchantment admin", description = "Publish for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentView publish(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "enchantmentAdminApi_discard", summary = "Discard - enchantment admin", description = "Discard for enchantment admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentView discard(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);
}
