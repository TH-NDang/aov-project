package com.wikiaov.build.internal.web;

import com.wikiaov.build.internal.application.BuildCommands.ConfirmCapture;
import com.wikiaov.build.internal.application.BuildCommands.ImportCapture;
import com.wikiaov.build.internal.application.BuildCommands.ReviewBuild;
import com.wikiaov.build.internal.application.response.BuildViews;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import java.util.UUID;

/** HTTP API documentation contract. Runtime mappings, binding and logic remain on the controller; validation is inherited from this interface. */
@Tag(name = "build admin")
public interface BuildCaptureApi {
    @Operation(operationId = "buildCaptureApi_list", summary = "List build captures", description = "Captures of the game's recommended builds, newest first, with how many builds still wait for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    PageSlice<BuildViews.Summary> list(@Parameter(description = "Market code.") String region,
            @Parameter(description = "Game tab: PRO, HOT or SYSTEM.") String source,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 20.") @Min(1) @Max(100) int size,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "buildCaptureApi_import", summary = "Import a build capture", description = "Stores builds read from screenshots. Heroes, items, arcana, enchantments and spells are named by code; arcana pages and enchantment sets are shared by content. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Created.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    BuildViews.Detail importCapture(@Valid ImportCapture body);

    @Operation(operationId = "buildCaptureApi_detail", summary = "Read a build capture", description = "Every hero of the capture with its builds, their evidence image and whether they wait for review. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    BuildViews.Detail detail(@Parameter(description = "Capture identifier.") UUID captureId,
            @Parameter(hidden = true) HttpServletRequest request);

    @Operation(operationId = "buildCaptureApi_review", summary = "Correct or review one build", description = "Replaces the content of one build and confirms or flags it. Flagging a build of a confirmed capture reopens the capture. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    BuildViews.Reviewed review(@Parameter(description = "Capture identifier.") UUID captureId,
            @Parameter(description = "Build identifier.") UUID buildId, @Valid ReviewBuild body);

    @Operation(operationId = "buildCaptureApi_confirm", summary = "Confirm a build capture", description = "Signs off the whole capture once no build waits for review; its builds then appear on the public Wiki. Requires hero:publish.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    BuildViews.Summary confirm(@Parameter(description = "Capture identifier.") UUID captureId,
            @Valid ConfirmCapture body);

    @Operation(operationId = "buildCaptureApi_delete", summary = "Delete a build capture", description = "For a capture imported by mistake; removes its images, heroes and builds, and shared values no build uses any more. Requires hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation."),
            @ApiResponse(responseCode = "default", description = "RFC 9457 Problem Details.", content = @Content(mediaType = "application/problem+json", schema = @Schema(ref = "#/components/schemas/ApiProblem")))
    })
    void delete(@Parameter(description = "Capture identifier.") UUID captureId,
            @Parameter(description = "Capture version the caller saw.") @Positive long expectedVersion);
}
