package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.response.ItemView;
import com.wikiaov.platform.PageLimits;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "item public")
public interface ItemPublicApi {

    @Operation(operationId = "itemPublicApi_list", summary = "List - item public", description = "List for item public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<ItemView> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "itemPublicApi_read", summary = "Read - item public", description = "Read for item public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ItemView read(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);
}
