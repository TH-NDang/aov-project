package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaOwnerView;
import com.wikiaov.media.internal.web.request.MergeOwnerRequest;
import com.wikiaov.media.internal.web.request.UpdateOwnerRequest;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Image owner catalog (03, ADR-017). Reading needs {@code catalog:read}; changes also need {@code media:write}. */
public interface MediaOwnerAdminApi {
    @Operation(operationId = "mediaOwnerAdminApi_list", summary = "List image owners", security = @SecurityRequirement(name = "bearerAuth"), description = "List image owners, most used first, optionally filtered by a name fragment ignoring case and whitespace. Requires catalog:read. Only q, page and size query parameters are accepted.", responses = {
            @ApiResponse(responseCode = "200", description = "Owners with the number of assets naming them.", useReturnTypeSchema = true)})
    PageSlice<MediaOwnerView> list(HttpServletRequest http, @Nullable @Size(max = 200) String q, @Min(0) int page,
            @Min(1) @Max(100) int size);

    @Operation(operationId = "mediaOwnerAdminApi_update", summary = "Rename an image owner", security = @SecurityRequirement(name = "bearerAuth"), description = "Rename an owner or change its contact for every source that names it. Requires catalog:read and media:write. A name another owner already has is rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Updated owner.", useReturnTypeSchema = true)})
    MediaOwnerView update(UUID id, @Valid UpdateOwnerRequest request);

    @Operation(operationId = "mediaOwnerAdminApi_merge", summary = "Merge image owners", security = @SecurityRequirement(name = "bearerAuth"), description = "Move every source of an owner to the target owner and remove the merged owner. Requires catalog:read and media:write.", responses = {
            @ApiResponse(responseCode = "200", description = "Target owner after the merge.", useReturnTypeSchema = true)})
    MediaOwnerView merge(UUID id, @Valid MergeOwnerRequest request);
}
