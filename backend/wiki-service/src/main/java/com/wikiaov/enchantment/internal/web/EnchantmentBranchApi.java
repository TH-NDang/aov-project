package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.EnchantmentBranchCommand;
import com.wikiaov.enchantment.internal.application.EnchantmentOrdering;
import com.wikiaov.enchantment.internal.application.response.EnchantmentBranchView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "enchantment branch")
public interface EnchantmentBranchApi {

    @Operation(operationId = "enchantmentBranchApi_list", summary = "List - enchantment branch", description = "List for enchantment branch. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<EnchantmentBranchView> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "enchantmentBranchApi_save", summary = "Save - enchantment branch", description = "Save for enchantment branch. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    EnchantmentBranchView save(
            @Parameter(description = "Authorization code returned by the identity provider.") String code,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid EnchantmentBranchCommand input);

    @Operation(operationId = "enchantmentBranchApi_reorder", summary = "Reorder - enchantment branch", description = "Reorder for enchantment branch. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('enchantment:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<EnchantmentBranchView> reorder(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid EnchantmentOrdering.Branches input);
}
