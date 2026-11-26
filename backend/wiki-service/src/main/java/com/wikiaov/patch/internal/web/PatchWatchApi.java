package com.wikiaov.patch.internal.web;

import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.AddPatchNotePost;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteSchedule;
import com.wikiaov.patch.internal.watch.application.PatchWatchCommands.ChangePatchNoteState;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNotePostView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchNoteSourceView;
import com.wikiaov.patch.internal.watch.application.PatchWatchViews.PatchWatchOverview;
import com.wikiaov.patch.internal.watch.domain.PatchNotePostState;
import com.wikiaov.patch.internal.watch.domain.PatchNoteSource;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.parameters.RequestBody;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/**
 * Patch watch (ADR-035): the publishers' patch-note pages read on a schedule, and the inbox of posts found. Every route
 * needs catalog:read (URL rule); changes need patch:write.
 */
@Tag(name = "patch watch")
public interface PatchWatchApi {

    @Operation(operationId = "patchWatchApi_overview", summary = "Read the patch watch", description = "Returns the number of new posts and every source with its schedule and the outcome of its last read. Requires catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Sources and the new-post count.", useReturnTypeSchema = true))
    PatchWatchOverview overview(@Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchWatchApi_posts", summary = "List found posts", description = "Pages through the posts found, newest first. Without a state every post is listed, those already old when their source was first read included. Requires catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Page of posts.", useReturnTypeSchema = true))
    PageSlice<PatchNotePostView> posts(
            @Parameter(description = "Inbox state; omit for every post.") PatchNotePostState state,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 30.") @Min(1) @Max(100) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "patchWatchApi_add", summary = "Add a post by hand", description = "Adds a post the check did not find, with its link, title, market and channel. The link must be unique. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "201", description = "Added post.", useReturnTypeSchema = true))
    ResponseEntity<PatchNotePostView> add(
            @RequestBody(description = "Link, title, market and channel. Unknown properties are rejected.", required = true) @Valid AddPatchNotePost input);

    @Operation(operationId = "patchWatchApi_changeState", summary = "Move a post in the inbox", description = "Marks a post new, done or dismissed at the version the editor saw. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Changed post.", useReturnTypeSchema = true))
    PatchNotePostView changeState(@Parameter(description = "Post id.") UUID id,
            @RequestBody(description = "State and expected version. Unknown properties are rejected.", required = true) @Valid ChangePatchNoteState input);

    @Operation(operationId = "patchWatchApi_changeSchedule", summary = "Change when a source is read", description = "Sets a daily time (Vietnam time) or a gap of 1 to 24 hours, or pauses the source, at the version the editor saw. The next read is planned from now. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "The source with its new schedule.", useReturnTypeSchema = true))
    PatchNoteSourceView changeSchedule(@Parameter(description = "Source code.") PatchNoteSource code,
            @RequestBody(description = "Mode, daily time, gap in hours, pause and expected version. Unknown properties are rejected.", required = true) @Valid ChangePatchNoteSchedule input);

    @Operation(operationId = "patchWatchApi_checkNow", summary = "Read every source now", description = "Reads each source this server can read, except those read in the last two minutes, and returns the overview. Paused sources are read too. Requires patch:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = @ApiResponse(responseCode = "200", description = "Overview after the read.", useReturnTypeSchema = true))
    PatchWatchOverview checkNow();
}
