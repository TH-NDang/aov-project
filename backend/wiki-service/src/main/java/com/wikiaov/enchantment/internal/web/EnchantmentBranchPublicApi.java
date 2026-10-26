package com.wikiaov.enchantment.internal.web;

import com.wikiaov.enchantment.internal.application.response.PublicEnchantmentBranchView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Tag(name = "enchantment public metadata")
public interface EnchantmentBranchPublicApi {
    @Operation(operationId = "enchantmentBranchPublicApi_list", summary = "List public enchantment-branches", description = "Read localized public metadata with usable images. Only the locale query parameter is accepted.", responses = {
            @ApiResponse(responseCode = "200", description = "Localized metadata.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    List<PublicEnchantmentBranchView> list(@Parameter(description = "Requested locale, default vi-VN.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);
}
