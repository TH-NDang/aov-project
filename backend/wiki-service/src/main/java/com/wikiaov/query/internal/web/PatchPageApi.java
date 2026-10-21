package com.wikiaov.query.internal.web;

import com.wikiaov.platform.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "patch page")
public interface PatchPageApi {

    @Operation(operationId = "patchPageApi_list", summary = "List - patch page", description = "List for patch page. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchPageApi_detail", summary = "Detail - patch page", description = "Detail for patch page. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> detail(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchPageApi_changes", summary = "Changes - patch page", description = "Changes for patch page. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> changes(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Change provider domain accepted by the current implementation.") String domain,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
