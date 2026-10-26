package com.wikiaov.item.internal.web;

import com.wikiaov.item.internal.application.response.PublicItemCategoryView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

@Tag(name = "item public metadata")
public interface ItemCategoryPublicApi {
    @Operation(operationId = "itemCategoryPublicApi_list", summary = "List public item-categories", description = "Read localized public metadata with usable images. Only the locale query parameter is accepted.", responses = {
            @ApiResponse(responseCode = "200", description = "Localized metadata.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    List<PublicItemCategoryView> list(@Parameter(description = "Requested locale, default vi-VN.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);
}
