package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.ItemCategoryCommand;
import com.wikiaov.item.internal.application.response.ItemCategoryView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "item category")
public interface ItemCategoryApi {

    @Operation(operationId = "itemCategoryApi_list", summary = "List - item category", description = "List for item category. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<ItemCategoryView> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "itemCategoryApi_save", summary = "Save - item category", description = "Save for item category. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('item:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ItemCategoryView save(@Parameter(description = "Authorization code returned by the identity provider.") String code,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid ItemCategoryCommand input);
}
