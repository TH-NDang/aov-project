package com.wikiaov.terminology.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.terminology.SkillReferenceProvider.Candidate;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.context.request.WebRequest;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "skill reference")
public interface SkillReferenceApi {

    @Operation(operationId = "skillReferenceApi_admin", summary = "Admin - skill reference", description = "Admin for skill reference. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PageSlice<Candidate> admin(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Ids.") String ids,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") Integer size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "skillReferenceApi_published", summary = "Published - skill reference", description = "Published for skill reference. Public read endpoint. Unrecognized query parameters are rejected.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<PageSlice<Candidate>> published(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Ids.") String ids,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") Integer size,
            @Parameter(description = "Optional published season in the market's current ruleset.") UUID seasonId,
            @Parameter(description = "Optional published patch variant; must belong to the selected season when supplied.") UUID patchVariantId,
            @Parameter(description = "Include observations without a known patch in an explicit historical scope; current reads always include them.") boolean includeUnscoped,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);
}
