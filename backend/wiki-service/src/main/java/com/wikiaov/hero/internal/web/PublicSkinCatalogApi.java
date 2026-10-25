package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.response.PublicSkinCatalogView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;

@Tag(name = "hero")
public interface PublicSkinCatalogApi {
    @Operation(operationId = "publicSkinCatalogApi_list", summary = "Browse published hero skins", description = "Reads skins from the currently effective published hero snapshots for a market. Hero and rarity filters describe the same visible catalog. Image metadata is batched for the selected page only. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Localized page and available hero/rarity filters.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<PublicSkinCatalogView> list(
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(description = "Canonical BCP 47 locale, default vi-VN.") String locale,
            @Parameter(description = "Accent-insensitive hero or skin text, at most 120 characters.") String q,
            @Parameter(description = "Exact hero code.") String hero,
            @Parameter(description = "Exact skin badge code.") String rarity,
            @Parameter(description = "Zero-based page.") int page,
            @Parameter(description = "Page size, from 1 to 60; default 24.") int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
