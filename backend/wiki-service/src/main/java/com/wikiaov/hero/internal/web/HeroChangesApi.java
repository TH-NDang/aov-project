package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroPatchView;
import com.wikiaov.hero.internal.change.application.HeroPatchChanges;
import com.wikiaov.hero.internal.domain.HeroChanges.*;
import com.wikiaov.platform.*;
import com.wikiaov.platform.PageLimits;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.*;
import org.springframework.http.*;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero changes")
public interface HeroChangesApi {

    @Operation(operationId = "heroChangesApi_record", summary = "Record - hero changes", description = "Record for hero changes. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Map<String, UUID> record(@Parameter(description = "Id identifier.") UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid com.wikiaov.hero.internal.domain.HeroChanges.Record body);

    @Operation(operationId = "heroChangesApi_assess", summary = "Assess - hero changes", description = "Assess for hero changes. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Map<String, Object> assess(@Parameter(description = "Id identifier.") UUID id,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) HeroPatchChanges.AssessmentInput input);

    @Operation(operationId = "heroChangesApi_recordPrevious", summary = "Record previous - hero changes", description = "Adds what a mechanic did before its change, written by an editor from a cited http(s) source; at most once per mechanic change and never edited. The recorded change and the derived patch view stay unchanged. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('patch:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Map<String, UUID> recordPrevious(@Parameter(description = "Change set identifier.") UUID changeSetId,
            @Parameter(description = "Mechanic change identifier.") UUID changeId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) HeroPatchChanges.PreviousInput input);

    @Operation(operationId = "heroChangesApi_authoringChanges", summary = "Authoring changes - hero changes", description = "Authoring changes for hero changes. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    List<Map<String, Object>> authoringChanges(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroChangesApi_patchView", summary = "Patch view - hero changes", description = "Hero gameplay data at a patch, derived on read from a selected published anchor (or the automatic anchor when omitted) and the recorded change sets; derived and carried values are marked and never stored. Requires a valid bearer token with catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroPatchView patchView(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Patch variant whose data is derived.") UUID patchVariantId,
            @Parameter(description = "Optional published revision of this hero and ruleset with a known effective patch.") UUID anchorRevisionId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroChangesApi_history", summary = "History - hero changes", description = "History for hero changes. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> history(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(PageLimits.MAX_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
