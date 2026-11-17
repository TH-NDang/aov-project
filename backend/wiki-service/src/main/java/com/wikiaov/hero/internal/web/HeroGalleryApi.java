package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.gallery.application.HeroGalleryView;
import com.wikiaov.platform.CreatedId;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero gallery")
public interface HeroGalleryApi {

    @Operation(operationId = "heroGalleryApi_read", summary = "Read - hero gallery", description = "Every image the hero's versions show, read from the versions, then the images attached straight to the hero (ADR-027). Requires a valid bearer token with catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroGalleryView read(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Locale for skill and skin names.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroGalleryApi_attach", summary = "Attach - hero gallery", description = "Attaches an existing image to the hero's gallery; it takes effect at once without publishing the hero. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Resource created.", useReturnTypeSchema = true)
    })
    CreatedId attach(@Parameter(description = "Hero id identifier.") UUID heroId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) HeroGalleryView.Attach body,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroGalleryApi_update", summary = "Update - hero gallery", description = "Changes how an attached image is described. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroGalleryView.Saved update(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Gallery item identifier.") UUID itemId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) HeroGalleryView.Update body,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroGalleryApi_remove", summary = "Remove - hero gallery", description = "Takes an attached image out of the hero's gallery; the image stays in media. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected. Direct authorization checks: hasAuthority('hero:write').", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void remove(@Parameter(description = "Hero id identifier.") UUID heroId,
            @Parameter(description = "Gallery item identifier.") UUID itemId,
            @Parameter(description = "Version the client last read.") long expectedVersion,
            @Parameter(hidden = true) HttpServletRequest request);
}
