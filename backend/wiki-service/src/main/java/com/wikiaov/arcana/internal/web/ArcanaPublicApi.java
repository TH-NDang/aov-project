package com.wikiaov.arcana.internal.web;

import com.wikiaov.arcana.internal.application.response.ArcanaView;
import com.wikiaov.platform.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "arcana public")
public interface ArcanaPublicApi {

    @Operation(operationId = "arcanaPublicApi_list", summary = "List - arcana public", description = "List for arcana public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PageSlice<ArcanaView> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") int size,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "arcanaPublicApi_read", summary = "Read - arcana public", description = "Read for arcana public. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ArcanaView read(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Optional published season; selects its latest eligible patch.") UUID seasonId,
            @Parameter(description = "Optional eligible published patch variant, consistent with the season.") UUID patchVariantId,
            @Parameter(description = "Include baseline observations without a verified historical patch.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request);
}
