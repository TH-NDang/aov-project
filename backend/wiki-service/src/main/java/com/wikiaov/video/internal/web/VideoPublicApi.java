package com.wikiaov.video.internal.web;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.VideoViews.PublicVideoList;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@Tag(name = "video")
public interface VideoPublicApi {
    @Operation(operationId = "videoPublicApi_list", summary = "List published videos of a subject", description = "Returns published videos in display order. The HERO kind includes the hero's skin videos. SKIN narrows to one skin when subjectKey is given. PATCH takes a patch variant id and returns the patch's own videos with the change videos that name it, oldest first, so the release splits them into before and after. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Published videos.", useReturnTypeSchema = true)
    })
    ResponseEntity<PublicVideoList> list(
            @Parameter(description = "Subject kind.") VideoSubjectKind subjectKind,
            @Parameter(description = "Entry id; the hero id for HERO and SKIN, the patch variant id for PATCH.") UUID subjectId,
            @Parameter(description = "Skin key.") String subjectKey,
            @Parameter(hidden = true) HttpServletRequest request);
}
