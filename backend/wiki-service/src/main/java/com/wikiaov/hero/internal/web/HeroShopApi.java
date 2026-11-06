package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.application.HeroShopCommands.SaveSkinAcquisition;
import com.wikiaov.hero.internal.application.response.HeroShopView;
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

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero admin")
public interface HeroShopApi {
    @Operation(operationId = "heroShopApi_read", summary = "Read a hero's shop facts", description = "The hero's price and how each skin is obtained in a market, including what waits for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroShopView read(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroShopApi_savePrice", summary = "Save a hero's price", description = "Applies at once without a draft, because the shop does not follow game patches. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroShopView.Price savePrice(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region, @Valid SavePrice body);

    @Operation(operationId = "heroShopApi_saveSkin", summary = "Save how a skin is obtained", description = "Applies at once without a draft. A voucher price is kept only for skins sold for vouchers. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    HeroShopView.SkinAcquisition saveSkin(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Skin key.") String skinKey,
            @Parameter(description = "Market code, default VN.") String region,
            @Valid SaveSkinAcquisition body);
}
