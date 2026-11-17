package com.wikiaov.hero.internal.web;

import com.wikiaov.hero.internal.application.HeroShopCommands.SavePrice;
import com.wikiaov.hero.internal.application.HeroShopCommands.SaveSkinAcquisition;
import com.wikiaov.hero.internal.application.response.HeroShopView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "hero admin")
public interface HeroShopApi {
    @Operation(operationId = "heroShopApi_read", summary = "Read a hero's shop facts", description = "What holds today for the hero's price and each skin in a market, with every dated step and what waits for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroShopView read(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "heroShopApi_savePrice", summary = "Save a hero's price", description = "Applies at once without a draft, because the shop does not follow game patches. A new date adds a step and keeps the earlier ones; the same date corrects that step. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroShopView.Price savePrice(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Market code, default VN.") String region, @Valid SavePrice body);

    @Operation(operationId = "heroShopApi_saveSkin", summary = "Save how a skin is obtained", description = "Applies at once without a draft. A new date adds a step and keeps the earlier ones. A voucher price is kept only for skins sold for vouchers. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    HeroShopView.SkinAcquisition saveSkin(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Skin key.") String skinKey,
            @Parameter(description = "Market code, default VN.") String region,
            @Valid SaveSkinAcquisition body);

    @Operation(operationId = "heroShopApi_deletePrice", summary = "Delete a price step", description = "For a step saved by mistake; a price that really changed keeps its old step. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void deletePrice(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Date of the step.") LocalDate capturedOn,
            @Parameter(description = "Market code, default VN.") String region);

    @Operation(operationId = "heroShopApi_deleteSkin", summary = "Delete an acquisition step", description = "For a step saved by mistake; an acquisition that really changed keeps its old step. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void deleteSkin(@Parameter(description = "Hero identifier.") UUID heroId,
            @Parameter(description = "Skin key.") String skinKey,
            @Parameter(description = "Date of the step.") LocalDate capturedOn,
            @Parameter(description = "Market code, default VN.") String region);
}
