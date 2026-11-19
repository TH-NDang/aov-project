package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.notes.application.PatchNotes.PatchNoteView;
import com.wikiaov.patch.internal.notes.application.PatchNotes.UpdatePatchNote;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;

@Tag(name = "patch notes")
public interface PatchNotesApi {
    @Operation(operationId = "patchNotes_read", summary = "Read additional patch notes", description = "Returns editorial notes for this variant and exact locale. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Localized notes", useReturnTypeSchema = true))
    PatchNoteView read(UUID id, String locale, @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchNotes_save", summary = "Save additional patch notes", description = "Replaces the localized notes at the supplied version without creating gameplay changes. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Saved notes", useReturnTypeSchema = true))
    PatchNoteView save(UUID id, String locale, UpdatePatchNote input);
}
