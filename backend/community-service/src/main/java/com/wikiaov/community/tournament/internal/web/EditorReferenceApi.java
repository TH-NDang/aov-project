package com.wikiaov.community.tournament.internal.web;

import com.wikiaov.community.platform.PageLimits;
import com.wikiaov.community.platform.PageSlice;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Entry;
import com.wikiaov.community.tournament.internal.reference.application.EditorReferences.Kind;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;

@Tag(name = "editor references")
public interface EditorReferenceApi {
    /** Returns minimal editor references without exposing unpublished registries through a public endpoint. */
    @Operation(operationId = "editorReferenceApi_references", summary = "Search teams and players to reference")
    PageSlice<Entry> references(@Size(max = Parameters.MAX_SEARCH) String q, Kind kind, List<UUID> ids,
            @Min(0) @Max(PageLimits.MAX_REGISTRY_PAGE) int page, @Min(1) @Max(PageLimits.MAX_REGISTRY_SIZE) int size,
            @Parameter(hidden = true) HttpServletRequest request);
}
