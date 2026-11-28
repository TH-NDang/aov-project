package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.stats.application.HeroStatRules.SetStatRule;
import com.wikiaov.hero.internal.stats.application.HeroStatRules.StatRuleView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Tag(name = "hero stat rules")
public interface HeroStatRulesApi {
    @Operation(operationId = "heroStatRules_list", summary = "Read the stats every hero shares", description = "Lists, for each stat, the level 1 value every hero starts with, the rise per level they share and the cap, whatever the patch.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Shared stats", useReturnTypeSchema = true))
    List<StatRuleView> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroStatRules_set", summary = "Set a stat every hero shares", description = "Writes the shared level 1 value, rise per level and cap of one stat. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Shared stat saved", useReturnTypeSchema = true))
    StatRuleView set(String key, SetStatRule input);

    @Operation(operationId = "heroStatRules_remove", summary = "Stop sharing a stat", description = "Removes the shared values of one stat; heroes keep their own. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "204", description = "Shared stat removed"))
    void remove(String key, long expectedVersion);
}
