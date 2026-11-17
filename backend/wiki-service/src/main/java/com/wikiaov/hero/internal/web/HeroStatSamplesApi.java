package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatSamples.Sample;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;

@Tag(name = "hero stat samples")
public interface HeroStatSamplesApi {
    @Operation(operationId = "heroStatSamples_forPatch", summary = "Read hero combat stat samples for one patch", description = "Returns explicit base stats and manual observations from the latest non-discarded revision per hero attached to this variant.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Patch samples", useReturnTypeSchema = true))
    List<Sample> forPatch(UUID id, @Parameter(hidden = true) HttpServletRequest request);
}
