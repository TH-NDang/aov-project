package com.wikiaov.spell.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.platform.PageLimits;
import com.wikiaov.spell.internal.application.response.SpellView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.*;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "spell public")
public interface SpellPublicApi {

    @Operation(operationId = "spellPublicApi_list", summary = "List - spell public", description = "List for spell public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SpellView> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellPublicApi_read", summary = "Read - spell public", description = "Read for spell public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SpellView read(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "spellPublicApi_archived", summary = "Archived - spell public", description = "Archived for spell public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SpellView> archived(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);
}
