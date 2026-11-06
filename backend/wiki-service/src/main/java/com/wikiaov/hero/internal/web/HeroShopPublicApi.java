package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroShopView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

@Tag(name = "hero")
public interface HeroShopPublicApi {
    @Operation(operationId = "heroShopPublicApi_read", summary = "Read a hero's shop facts", description = "The hero's price and how each skin is obtained in a market. Entries still waiting for review are left out.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroShopView read(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(hidden = true) HttpServletRequest request);
}
