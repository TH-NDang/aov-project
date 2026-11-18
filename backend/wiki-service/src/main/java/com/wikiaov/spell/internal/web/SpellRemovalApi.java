package com.wikiaov.spell.internal.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "spell removal")
public interface SpellRemovalApi {

    @Operation(operationId = "spellRemovalApi_forVariant", summary = "For variant - spell removal", description = "For variant for spell removal. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<Map<String, Object>> forVariant(@Parameter(description = "Patch variant id identifier.") UUID patchVariantId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);
}
