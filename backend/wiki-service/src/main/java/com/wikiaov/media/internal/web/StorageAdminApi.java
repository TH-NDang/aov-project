package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.capacity.application.CapacityCommands;
import com.wikiaov.media.internal.capacity.application.StorageCapacityViews;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

/** How much of the R2 free tier the project uses, and what an upload would add (03, ADR-030 section 9). */
@Tag(name = "storage admin")
public interface StorageAdminApi {
    @Operation(operationId = "storageAdminApi_summary", summary = "Storage summary", description = "Bytes and files per bucket and per kind, uploads per month and this month's operations against the R2 free tier. Figures come from the database; Cloudflare analytics replace them when configured. Requires catalog:read. No query parameter is accepted.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    StorageCapacityViews.Summary summary(@Parameter(hidden = true) HttpServletRequest http);

    @Operation(operationId = "storageAdminApi_estimate", summary = "Estimate an upload batch", description = "New files, new bytes, R2 operations and storage after an upload of up to 20,000 files. Source bytes already stored cost nothing. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    StorageCapacityViews.Estimate estimate(@Valid CapacityCommands.EstimateCommand body);
}
