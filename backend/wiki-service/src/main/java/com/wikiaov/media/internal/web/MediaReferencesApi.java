package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.web.request.SourceReferencesRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.UUID;

public interface MediaReferencesApi {
    @Operation(operationId = "mediaAdminApi_updateSourceReferences", summary = "Update source page references", description = "Update optional community page IDs without changing credit, source URLs or image bytes. Requires catalog:read and media:write. These soft references confer no ownership rights.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Asset with updated source page references.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "400", description = "Invalid identifiers or request body; expectedVersion must be present and nonnegative.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "401", description = "A valid bearer access token is required.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "403", description = "The authenticated actor lacks catalog:read or media:write.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "404", description = "The asset does not exist or the source does not belong to it.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "409", description = "The asset is not active or the source reference version has changed.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem"))),
            @ApiResponse(responseCode = "default", description = "Failure expressed as RFC 9457 Problem Details, including the module-specific code and requestId when available.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    MediaAssetDetails update(UUID assetId, UUID sourceId, @Valid SourceReferencesRequest request);
}
