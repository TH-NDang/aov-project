package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroPublishReadinessView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Tag(name = "hero publish readiness")
public interface HeroPublishReadinessApi {
    @Operation(operationId = "heroPublishReadiness_list", summary = "Read the publication state of every hero", description = "Returns every hero with its non-discarded revisions and, for each open draft, the fields the Admin publish rules read. It does not judge a draft: publishing remains validated by the publish endpoint. Requires catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Every hero, ordered by code.", useReturnTypeSchema = true))
    List<HeroPublishReadinessView> list(@Parameter(hidden = true) HttpServletRequest request);
}
