package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.PatchSource;
import com.wikiaov.patch.internal.notes.application.PatchSourceLinks.UpdatePatchSources;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;

@Tag(name = "patch notes")
public interface PatchSourcesApi {
    @Operation(operationId = "patchSources_read", summary = "Read the source links of a patch", description = "Returns the links to the official notes of this variant in their order. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Source links", useReturnTypeSchema = true))
    List<PatchSource> read(UUID id, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchSources_save", summary = "Replace the source links of a patch", description = "Replaces every source link of this variant with the supplied list, at most 10. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Saved source links", useReturnTypeSchema = true))
    List<PatchSource> save(UUID id, UpdatePatchSources input);
}
