package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.SkinImagePublicationRequest;
import com.wikiaov.hero.internal.application.response.HeroRevisionView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;

@Tag(name = "hero skin images")
public interface SkinImagePublicationApi {
    @Operation(operationId = "skinImagePublicationApi_publish", summary = "Publish skin images without publishing draft content", description = "Requires catalog:read, hero:write and hero:publish. Copies only artwork bindings and image options from the specified draft to the current published hero. Retains every non-image field and existing draft. The supplied published source and draft version must still match.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "The new visual-only published revision, or the current source when its images already match.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "409", description = "The published source or image draft version changed.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroRevisionView publish(UUID heroId, @Valid SkinImagePublicationRequest body,
            @Parameter(hidden = true) HttpServletRequest request);
}
