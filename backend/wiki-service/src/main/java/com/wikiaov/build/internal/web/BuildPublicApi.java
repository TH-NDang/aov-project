package com.wikiaov.build.internal.web;

import com.wikiaov.build.internal.application.response.BuildViews;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

@Tag(name = "build")
public interface BuildPublicApi {
    @Operation(operationId = "buildPublicApi_heroBuilds", summary = "Recommended builds of a hero", description = "For each game tab, the builds of the newest confirmed capture of the market that lists the hero. Builds with equal content are merged with every place they hold in the game's list. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Recommended builds.", useReturnTypeSchema = true)
    })
    ResponseEntity<BuildViews.HeroBuilds> heroBuilds(
            @Parameter(description = "Hero or hero form code; a legacy code resolves to the current hero.") String hero,
            @Parameter(description = "Market code, e.g. VN.") String region,
            @Parameter(hidden = true) HttpServletRequest request);
}
