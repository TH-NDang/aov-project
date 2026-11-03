package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.web.request.SourceReferencesRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import jakarta.validation.Valid;
import java.util.UUID;

public interface MediaReferencesApi {
    @Operation(operationId = "mediaAdminApi_updateSourceReferences", summary = "Update source page references", description = "Update optional community page IDs without changing credit, source URLs or image bytes. Requires catalog:read and media:write. These soft references confer no ownership rights.", security = @SecurityRequirement(name = "bearerAuth"))
    MediaAssetDetails update(UUID assetId, UUID sourceId, @Valid SourceReferencesRequest request);
}
