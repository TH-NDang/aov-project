package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.PageLimits;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.spell.internal.application.SpellCommands.Create;
import com.wikiaov.spell.internal.application.SpellCommands.Fork;
import com.wikiaov.spell.internal.application.SpellCommands.Mutation;
import com.wikiaov.spell.internal.application.SpellCommands.Removal;
import com.wikiaov.spell.internal.application.SpellCommands.Update;
import com.wikiaov.spell.internal.application.response.SpellRemovalView;
import com.wikiaov.spell.internal.application.response.SpellView;
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
@Tag(name = "spell admin")
public interface SpellAdminApi {

    @Operation(operationId = "spellAdminApi_list", summary = "List - spell admin", description = "List for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SpellView> list(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Season id identifier.") UUID seasonId,
            @Parameter(description = "Patch variant id identifier.") UUID patchVariantId,
            @Parameter(description = "Include entries that have no changes in the selected context.") boolean includeUnchanged,
            @Parameter(description = "Include published observations without a known patch as a fallback.") boolean includeUnscoped,
            @Parameter(description = "List working drafts across patches in one ruleset.") boolean draftsOnly,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellAdminApi_latest", summary = "Latest - spell admin", description = "Latest for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView latest(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellAdminApi_create", summary = "Create - spell admin", description = "Create for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    SpellView create(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Create input);

    @Operation(operationId = "spellAdminApi_history", summary = "History - spell admin", description = "History for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<SpellView.Revision> history(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellAdminApi_read", summary = "Read - spell admin", description = "Read for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView read(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellAdminApi_fork", summary = "Fork - spell admin", description = "Fork for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    SpellView fork(@Parameter(description = "Id identifier.") UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Fork input);

    @Operation(operationId = "spellAdminApi_update", summary = "Update - spell admin", description = "Update for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView update(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Update input);

    @Operation(operationId = "spellAdminApi_publish", summary = "Publish - spell admin", description = "Publish for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView publish(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "spellAdminApi_discard", summary = "Discard - spell admin", description = "Discard for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView discard(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Revision id identifier.") UUID revisionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Mutation input);

    @Operation(operationId = "spellAdminApi_removals", summary = "Removals - spell admin", description = "Removals for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<SpellRemovalView> removals(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellAdminApi_recordRemoval", summary = "Record removal - spell admin", description = "Record removal for spell admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('spell:publish').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    SpellRemovalView recordRemoval(@Parameter(description = "Id identifier.") UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid Removal input);
}
