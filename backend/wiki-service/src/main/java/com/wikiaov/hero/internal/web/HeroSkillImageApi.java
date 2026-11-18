package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.HeroSkillImageView;
import com.wikiaov.hero.internal.web.request.SaveHeroSkillImage;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero skill image")
public interface HeroSkillImageApi {

    @Operation(operationId = "heroSkillImageApi_list", summary = "List - hero skill image", description = "List for hero skill image. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    Map<String, List<HeroSkillImageView>> list(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroSkillImageApi_save", summary = "Save - hero skill image", description = "Save for hero skill image. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroSkillImageView save(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Source slot.") int sourceSlot,
            @Parameter(description = "Variant no.") int variantNo,
            @RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid SaveHeroSkillImage body,
            @Parameter(hidden = true) HttpServletRequest request);
}
