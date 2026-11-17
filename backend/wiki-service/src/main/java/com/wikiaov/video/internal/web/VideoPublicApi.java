package com.wikiaov.video.internal.web;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.VideoViews.PublicVideoList;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

@Tag(name = "video")
public interface VideoPublicApi {
    @Operation(operationId = "videoPublicApi_list", summary = "List published videos of a subject", description = "Returns published videos in display order. The HERO kind includes the hero's skill and skin videos. SKILL and SKIN narrow to one subject when subjectKey is given. Unrecognized query parameters are rejected.", responses = {
            @ApiResponse(responseCode = "200", description = "Published videos.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    ResponseEntity<PublicVideoList> list(
            @Parameter(description = "Subject kind.") VideoSubjectKind subjectKind,
            @Parameter(description = "Entry id; the hero id for HERO, SKILL and SKIN.") UUID subjectId,
            @Parameter(description = "Skill or skin key.") String subjectKey,
            @Parameter(hidden = true) HttpServletRequest request);
}
