package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.SeasonUpdatesView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

@Tag(name = "season")
public interface SeasonUpdatesApi {
    @Operation(operationId = "seasonUpdatesApi_current", summary = "Read current-season updates", description = "Public read of published, already effective patch releases in the current verified market season. Returns an empty season when no current context or season is known. Rejects unrecognized query parameters.", responses = {
            @ApiResponse(responseCode = "200", description = "Current season and at most ten effective patches.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<SeasonUpdatesView> current(
            @Parameter(description = "Available market code.") String region,
            @Parameter(description = "Canonical BCP 47 locale, with deterministic translation fallback.") String locale,
            @Parameter(description = "Maximum number of effective patches, from 1 to 10; defaults to 4.") int limit,
            @Parameter(hidden = true) HttpServletRequest request);
}
