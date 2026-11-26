package com.wikiaov.query.internal.web;

import com.wikiaov.query.internal.application.PatchChangedVariants;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.web.context.request.WebRequest;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "patch page")
public interface PatchChangeMarksApi {

    @Operation(operationId = "patchChangeMarksApi_changedVariants", summary = "Changed variants - patch page", description = "The published variants of the market's catalog whose patch changed one domain, newest first. Public read endpoint. Unrecognized query parameters are rejected. A variant is listed when its patch page for the domain holds at least one change.", parameters = @Parameter(name = "If-None-Match", in = io.swagger.v3.oas.annotations.enums.ParameterIn.HEADER, schema = @Schema(type = "string"), description = "Previously returned ETag; a matching representation returns 304 without a body."), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "304", description = "The representation matches the supplied ETag.")
    })
    ResponseEntity<PatchChangedVariants> changedVariants(
            @Parameter(description = "Region code used to resolve the published gameplay context.") String region,
            @Parameter(description = "Public patch change domain.", schema = @Schema(allowableValues = {"HERO",
                    "SPELL", "ITEM", "ENCHANTMENT",
                    "ARCANA"})) @Pattern(regexp = "HERO|SPELL|ITEM|ENCHANTMENT|ARCANA") String domain,
            @Parameter(hidden = true) HttpServletRequest request, @Parameter(hidden = true) WebRequest web);
}
