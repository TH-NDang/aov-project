package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroShopView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDate;
import java.util.UUID;

@Tag(name = "hero")
public interface HeroShopPublicApi {
    @Operation(operationId = "heroShopPublicApi_read", summary = "Read a hero's shop facts", description = "The hero's price and how each skin is obtained in a market on a given day, today by default. Entries still waiting for review are left out.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroShopView read(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(description = "Day to read, as yyyy-mm-dd; today when omitted.") LocalDate at,
            @Parameter(hidden = true) HttpServletRequest request);
}
