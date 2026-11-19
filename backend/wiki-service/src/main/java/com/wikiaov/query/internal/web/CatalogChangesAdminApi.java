package com.wikiaov.query.internal.web;

import com.wikiaov.platform.CatalogChanges;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "catalog changes admin")
public interface CatalogChangesAdminApi {

    @Operation(operationId = "catalogChangesAdminApi_list", summary = "List - catalog changes admin", description = "List for catalog changes admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<CatalogChanges.Entry> list(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Registered catalog change provider: ARCANA, ENCHANTMENT, ITEM or SPELL. HERO uses its separate hero change endpoints. Unsupported provider names are rejected.", schema = @Schema(allowableValues = {
                    "ARCANA", "ENCHANTMENT", "ITEM", "SPELL"})) String domain,
            @Parameter(hidden = true) HttpServletRequest request);
}
