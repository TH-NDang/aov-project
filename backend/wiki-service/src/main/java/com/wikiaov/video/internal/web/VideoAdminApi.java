package com.wikiaov.video.internal.web;

import com.wikiaov.platform.PageSlice;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.application.VideoCommands.ImportVideos;
import com.wikiaov.video.internal.application.VideoCommands.SaveVideo;
import com.wikiaov.video.internal.application.VideoViews.AdminVideo;
import com.wikiaov.video.internal.application.VideoViews.ImportResult;
import com.wikiaov.video.internal.application.VideoViews.SubjectList;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/**
 * Admin video API. Every route needs {@code catalog:read} (URL rule). Changes also need the write capability of the
 * subject's module, plus its publish capability when a video enters or leaves the published state (ADR-019).
 */
@Tag(name = "video admin")
public interface VideoAdminApi {
    @Operation(operationId = "videoAdminApi_list", summary = "Search videos", description = "Pages through videos of every status. Filtering HERO with a subject id includes that hero's skill and skin videos. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Page of videos.", useReturnTypeSchema = true))
    PageSlice<AdminVideo> list(
            @Parameter(description = "Subject kind.") VideoSubjectKind subjectKind,
            @Parameter(description = "Entry id; the hero id for HERO, SKILL and SKIN.") UUID subjectId,
            @Parameter(description = "Skill or skin key.") String subjectKey,
            @Parameter(description = "Status.") VideoStatus status,
            @Parameter(description = "Purpose.") VideoPurpose purpose,
            @Parameter(description = "How the row was created.") VideoOrigin origin,
            @Parameter(description = "Text in the title or link.") String q,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 24.") @Min(1) @Max(100) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "videoAdminApi_subjects", summary = "List subjects that can have videos", description = "Returns every hero, skill, skin and warehouse entry with its display name and alternative names, for pickers and for matching imported data. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "All subjects.", useReturnTypeSchema = true))
    SubjectList subjects(@Parameter(description = "Preferred locale for names, default vi-VN.") String locale,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "videoAdminApi_create", summary = "Attach a video", description = "Normalizes the link and attaches it to the subject. Requires the subject's write capability, and its publish capability for a published video.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "201", description = "Attached video.", useReturnTypeSchema = true))
    ResponseEntity<AdminVideo> create(SaveVideo input);

    @Operation(operationId = "videoAdminApi_update", summary = "Change a video", description = "Replaces the video at the supplied version. Requires the same capabilities as attaching, for both the current and the new state.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Changed video.", useReturnTypeSchema = true))
    AdminVideo update(UUID id, SaveVideo input);

    @Operation(operationId = "videoAdminApi_delete", summary = "Remove a video", description = "Removes the video at the supplied version. To keep an imported video from returning on the next import, hide it instead.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "204", description = "Removed."))
    ResponseEntity<Void> delete(UUID id, @Parameter(description = "Version being removed.") long expectedVersion);

    @Operation(operationId = "videoAdminApi_import", summary = "Import a batch of videos", description = "Adds up to 500 videos. Rows already attached are skipped and left unchanged; invalid rows are reported without failing the batch. Requires the capabilities of every row.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Counts and rejected rows.", useReturnTypeSchema = true))
    ImportResult importVideos(ImportVideos input);
}
