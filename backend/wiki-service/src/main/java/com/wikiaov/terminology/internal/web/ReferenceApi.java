package com.wikiaov.terminology.internal.web;

import com.wikiaov.platform.*;
import com.wikiaov.terminology.internal.application.response.AdminReferenceCatalogView;
import com.wikiaov.terminology.internal.application.response.ReferenceSettingsView;
import com.wikiaov.terminology.internal.web.request.SaveReferenceSettings;
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
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.*;
import org.springframework.web.context.request.WebRequest;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "reference")
public interface ReferenceApi {

    @Operation(operationId = "referenceApi_adminReferences", summary = "Admin references - reference", description = "Admin references for reference. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    AdminReferenceCatalogView adminReferences(@Parameter(description = "Ruleset id identifier.") UUID rulesetId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "referenceApi_references", summary = "References - reference", description = "References for reference. Public read endpoint. Unrecognized query parameters are rejected.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<ReferenceSettingsView> references(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "referenceApi_publicSettings", summary = "Public settings - reference", description = "Public settings for reference. Public read endpoint. Unrecognized query parameters are rejected.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<ReferenceSettingsView> publicSettings(@Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "referenceApi_adminSettings", summary = "Admin settings - reference", description = "Admin settings for reference. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ReferenceSettingsView adminSettings(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "referenceApi_save", summary = "Save - reference", description = "Save for reference. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks a required capability or fails an authorization rule.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ReferenceSettingsView save(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SaveReferenceSettings request);
}
