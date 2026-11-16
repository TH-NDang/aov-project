package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroRankingViews;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;

@Tag(name = "hero")
public interface HeroEvaluationPublicApi {
    @Operation(operationId = "heroEvaluationPublicApi_ranking", summary = "Read a hero's ranked figures", description = "The hero in the latest confirmed snapshot of the game's ranking boards for a market and mode (ADR-025, ADR-029): tier, win, pick and ban rates, per-match figures with their rank among the snapshot's heroes, and the heroes the game says it wins against more often. Values waiting for review are null. Both parts are null when no snapshot is confirmed; the entry is null when the snapshot lacks the hero.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroRankingViews.Published ranking(@Parameter(description = "Hero or hero form identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(description = "Mode code, default RANKED_ELITE.") String mode,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroEvaluationPublicApi_traits", summary = "List heroes by trait", description = "For every trait code (ADR-029), the heroes and forms readers see with it in a market today, as {id, code}. Heroes that hold forms are not listed; their forms are.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    Map<String, Object> traits(@Parameter(description = "Market code, default VN.") String region,
            @Parameter(hidden = true) HttpServletRequest request);
}
