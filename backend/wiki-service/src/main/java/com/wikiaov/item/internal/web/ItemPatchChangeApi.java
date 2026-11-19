package com.wikiaov.item.internal.web;

import com.wikiaov.platform.CatalogChanges;
import com.wikiaov.platform.CreatedId;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "item patch change")
public interface ItemPatchChangeApi {

    @Operation(operationId = "itemPatchChangeApi_record", summary = "Record - item patch change", description = "Record for item patch change. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('item:publish') and hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId record(@Parameter(description = "Id identifier.") UUID id,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) CatalogChanges.Record input);
}
