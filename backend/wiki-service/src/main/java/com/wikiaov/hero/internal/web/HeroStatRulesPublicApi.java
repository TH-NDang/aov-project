package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatRules.StatRuleView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Tag(name = "hero")
public interface HeroStatRulesPublicApi {
    @Operation(operationId = "heroStatRulesPublicApi_list", summary = "Read the stats every hero shares", description = "For each stat, the level 1 value every hero starts with, the rise per level they share and the most it reaches in a match. A hero's own value replaces the shared one.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<StatRuleView> list(@Parameter(hidden = true) HttpServletRequest request);
}
