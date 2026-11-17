package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroImportRequest;
import com.wikiaov.hero.internal.application.response.HeroImportPlan;
import com.wikiaov.hero.internal.importing.application.HeroImports;
import com.wikiaov.hero.internal.importing.application.HeroImports.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero import")
public interface HeroImportApi {

    @Operation(operationId = "heroImportApi_fields", summary = "Fields - hero import", description = "Fields for hero import. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<HeroImports.Field> fields(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroImportApi_preview", summary = "Preview - hero import", description = "Preview for hero import. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroImportPlan preview(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid HeroImportRequest request);

    @Operation(operationId = "heroImportApi_relationFields", summary = "Relation fields - hero import", description = "Relation fields for hero import. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    java.util.Map<String, List<HeroImports.Field>> relationFields(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroImportApi_contexts", summary = "Contexts - hero import", description = "Contexts for hero import. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<com.wikiaov.patch.AuthoringContext> contexts(
            @Parameter(description = "Region id identifier.") java.util.UUID regionId,
            @Parameter(description = "Season id identifier.") java.util.UUID seasonId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroImportApi_apply", summary = "Apply - hero import", description = "Apply for hero import. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroImportPlan apply(
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid HeroImportRequest request);
}
