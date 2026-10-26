package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.CatalogContextView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

@Tag(name = "catalog context")
public interface CatalogContextApi {
    @Operation(operationId = "catalogContextApi_read", summary = "Read public catalog scope choices", description = "Published seasons and patches in the requested market's verified current ruleset. Future or draft variants are excluded. Undated historical observations retain an unknown date. Rejects unrecognized query parameters.", responses = {
            @ApiResponse(responseCode = "200", description = "Available markets, UI languages and published catalog scopes.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<CatalogContextView> read(
            @Parameter(description = "Available market code, default VN.") String region,
            @Parameter(description = "Supported UI locale: vi-VN or en-US.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);
}
