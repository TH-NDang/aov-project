package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.application.response.RegionView;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "region")
public interface RegionApi {

    @Operation(operationId = "regionApi_list", summary = "List - region", description = "List for region. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    List<RegionView> list(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "regionApi_select", summary = "Select - region", description = "Select for region. Public read endpoint. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    RegionView select(@Parameter(description = "Authorization code returned by the identity provider.") String code,
            @Parameter(hidden = true) HttpServletRequest request);
}
