package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaDeletionView;
import com.wikiaov.media.internal.web.request.DeleteMediaRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;

@Tag(name = "media admin")
public interface MediaDeletionApi {
    @Operation(operationId = "mediaDeletionApi_delete", summary = "Delete unused media bytes and purge CDN URLs", description = "Requires catalog:read and media:write. Rejects all Wiki and competition references. Retries resume durable deletion checkpoints using the original expectedVersion. Metadata and audit remain.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Deletion completed"),
            @ApiResponse(responseCode = "409", description = "Image is referenced, uploading, stale or already being deleted"),
            @ApiResponse(responseCode = "502", description = "Competition check or CDN purge failed; retry is safe"),
            @ApiResponse(responseCode = "503", description = "Storage or CDN configuration is unavailable")
    })
    MediaDeletionView delete(UUID assetId, @Valid DeleteMediaRequest request);

    @Operation(operationId = "mediaDeletionApi_status", summary = "Read durable media deletion progress", description = "Requires catalog:read and media:write. Returns origin deletion and cache purge progress without storage credentials or object keys.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Deletion progress"),
            @ApiResponse(responseCode = "404", description = "No deletion was requested")
    })
    MediaDeletionView status(UUID assetId);
}
