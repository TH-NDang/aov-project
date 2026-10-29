package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaContactView;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;

public interface MediaContactAdminApi {
    @Operation(operationId = "mediaContactAdminApi_list", summary = "List private media contact requests", security = @SecurityRequirement(name = "bearerAuth"), description = "Read private contact details and messages. Requires catalog:read and media:write. Only page and size query parameters are accepted.", responses = {
            @ApiResponse(responseCode = "200", description = "Contact requests ordered by newest first.", useReturnTypeSchema = true)})
    PageSlice<MediaContactView> list(HttpServletRequest http, @Min(0) int page, @Min(1) @Max(100) int size);

    @Operation(operationId = "mediaContactAdminApi_resolve", summary = "Resolve a media contact request", security = @SecurityRequirement(name = "bearerAuth"), description = "Mark a request resolved without sending email. Requires catalog:read and media:write. Repeating resolution preserves the original resolution time.", responses = {
            @ApiResponse(responseCode = "200", description = "Resolved contact request.", useReturnTypeSchema = true)})
    MediaContactView resolve(UUID id);
}
