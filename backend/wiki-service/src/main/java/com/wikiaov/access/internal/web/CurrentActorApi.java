package com.wikiaov.access.internal.web;

import com.wikiaov.access.Actor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;

/** Returns identity and capabilities from the verified access token. */
@Tag(name = "current actor")
public interface CurrentActorApi {

    @Operation(operationId = "currentActorApi_me", summary = "Me - current actor", description = "Me for current actor. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    Actor me(@Parameter(hidden = true) HttpServletRequest request);
}
