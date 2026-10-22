package com.wikiaov.hero.internal.web;

import com.wikiaov.platform.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.enums.ParameterIn;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.security.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.web.context.request.WebRequest;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero public")
public interface HeroPublicApi {

    @Operation(operationId = "heroPublicApi_list", summary = "List - hero public", description = "List for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> list(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(description = "Zero-based page index.") int page,
            @Parameter(description = "Maximum number of entries in a page.") int size,
            @Parameter(description = "Search text.") String q,
            @Parameter(description = "Hero role filter.") String role,
            @Parameter(description = "Sort expression accepted by this endpoint.") String sort,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_detail", summary = "Detail - hero public", description = "Detail for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> detail(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_manifest", summary = "Manifest - hero public", description = "Manifest for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> manifest(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionPROFILE", summary = "Section profile - hero public", description = "Section profile for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionPROFILE(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionOVERVIEW_RATINGS", summary = "Section overview ratings - hero public", description = "Section overview ratings for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionOVERVIEW_RATINGS(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionCOMBAT_STATS", summary = "Section combat stats - hero public", description = "Section combat stats for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionCOMBAT_STATS(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionSKILLS", summary = "Section skills - hero public", description = "Section skills for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionSKILLS(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionSKINS", summary = "Section skins - hero public", description = "Section skins for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionSKINS(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);

    @Operation(operationId = "heroPublicApi_sectionMEDIA_BINDINGS", summary = "Section media bindings - hero public", description = "Section media bindings for hero public. Public read endpoint. Unrecognized query parameters are rejected. Returns the existing dynamic JSON object; property availability depends on the selected context and content.", parameters = @Parameter(name = "If-None-Match", in = ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Successful operation.", content = @Content(mediaType = "application/json", schema = @Schema(type = "object", additionalProperties = Schema.AdditionalPropertiesValue.TRUE))),
            @ApiResponse(responseCode = "304", headers = {
                    @Header(name = "ETag", description = "Representation entity tag.", schema = @Schema(type = "string")),
                    @Header(name = "Cache-Control", description = "Cache policy for this representation.", schema = @Schema(type = "string"))}, description = "Representation not modified; no response body.", content = @Content),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<?> sectionMEDIA_BINDINGS(@Parameter(description = "Id identifier.") UUID id,
            @Parameter(description = "Requested translation locale.") String locale,
            @Parameter(hidden = true) HttpServletRequest request,
            @Parameter(hidden = true) WebRequest web);
}
