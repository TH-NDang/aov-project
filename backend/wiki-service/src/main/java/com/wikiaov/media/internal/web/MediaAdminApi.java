package com.wikiaov.media.internal.web;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.response.MediaAssetBatch;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaAssetSummary;
import com.wikiaov.media.internal.application.response.MediaUsageReport;
import com.wikiaov.media.internal.application.response.MediaUsageState;
import com.wikiaov.media.internal.application.response.MediaUsageTotals;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.application.response.UploadStatus;
import com.wikiaov.media.internal.application.response.UploadTicket;
import com.wikiaov.media.internal.web.request.CreateAssetRequest;
import com.wikiaov.media.internal.web.request.DeprecateRequest;
import com.wikiaov.media.internal.web.request.ExpectedVersionRequest;
import com.wikiaov.media.internal.web.request.FocalPointRequest;
import com.wikiaov.media.internal.web.request.RegisterImportRequest;
import com.wikiaov.media.internal.web.request.SourceRequest;
import com.wikiaov.media.internal.web.request.UploadRequest;
import com.wikiaov.media.internal.web.request.UsageScopeParameter;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;

/**
 * Admin media API (03 part E). Every route needs {@code catalog:read} (URL rule); the use cases additionally
 * require {@code media:write} for changes.
 */
@Tag(name = "media admin")
public interface MediaAdminApi {

    @Operation(operationId = "mediaAdminApi_addSource", summary = "Add version attribution", security = @SecurityRequirement(name = "bearerAuth"), description = "Add attribution to the specified version. Requires catalog:read and media:write. Repeating identical attribution is a no-op.", responses = {
            @ApiResponse(responseCode = "200", description = "Asset with recorded attribution.", useReturnTypeSchema = true)
    })
    MediaAssetDetails addSource(UUID assetId, UUID versionId, @Valid SourceRequest source);

    @Operation(operationId = "mediaAdminApi_setFocalPoint", summary = "Choose the point to keep in view when cropping", description = "Marks the main subject of a version, usually a face, so fixed-size crops keep it in view. Requires a valid bearer token with hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Asset with the saved point.", useReturnTypeSchema = true)
    })
    MediaAssetDetails setFocalPoint(UUID assetId, UUID versionId, @Valid FocalPointRequest point);

    @Operation(operationId = "mediaAdminApi_clearFocalPoint", summary = "Forget the chosen focal point", description = "Crops of this version return to their default position. Requires a valid bearer token with hero:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Asset without a saved point.", useReturnTypeSchema = true)
    })
    MediaAssetDetails clearFocalPoint(UUID assetId, UUID versionId);

    @Operation(operationId = "mediaAdminApi_createAsset", summary = "Create asset - media admin", description = "Create asset for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", headers = @Header(name = "Location", description = "URI of the created asset or upload status resource.", schema = @Schema(type = "string", format = "uri-reference")), description = "Resource created.", useReturnTypeSchema = true)
    })
    ResponseEntity<MediaAssetDetails> createAsset(
            @Parameter(description = "Supported API version: v1.") String apiVersion,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid CreateAssetRequest request);

    @Operation(operationId = "mediaAdminApi_listAssets", summary = "List assets - media admin", description = "List assets for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<MediaAssetSummary> listAssets(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Semantic type.") MediaSemanticType semanticType,
            @Parameter(description = "Only uploaded images without a complete current source and owner credit. Defaults to false.") boolean needsCredit,
            @Parameter(description = "Only images in this usage state. Adds the usage summary to each row.") MediaUsageState usage,
            @Parameter(description = "Adds the usage summary to each row. Defaults to false.") boolean withUsage,
            @Parameter(description = "Zero-based page index.") @Min(0) int page,
            @Parameter(description = "Maximum number of entries in a page.") @Min(1) @Max(100) int size);

    @Operation(operationId = "mediaAdminApi_usageTotals", summary = "Usage totals - media admin", description = "How many images are in each usage state for the same filters as the asset list. Requires a valid bearer token with catalog:read. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaUsageTotals usageTotals(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Semantic type.") MediaSemanticType semanticType,
            @Parameter(description = "Only uploaded images without a complete current source and owner credit. Defaults to false.") boolean needsCredit);

    @Operation(operationId = "mediaAdminApi_getAsset", summary = "Get asset - media admin", description = "Get asset for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaAssetDetails getAsset(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Asset id identifier.") UUID assetId);

    @Operation(operationId = "mediaAdminApi_getAssets", summary = "Get several assets - media admin", description = "Get up to 100 assets for media admin in one request, so a screen of images does not read them one by one. Items follow the requested order; a repeated id appears once and an unknown id is left out instead of failing the request. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaAssetBatch getAssets(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Asset ids separated by commas, at most 100.") @Size(min = 1, max = 100) List<@NotNull UUID> ids);

    @Operation(operationId = "mediaAdminApi_requestUpload", summary = "Request upload - media admin", description = "Create a presigned upload ticket. Upload bytes directly to object storage, then call complete; bytes never pass through this API. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", headers = @Header(name = "Location", description = "URI of the created asset or upload status resource.", schema = @Schema(type = "string", format = "uri-reference")), description = "Resource created.", useReturnTypeSchema = true)
    })
    ResponseEntity<UploadTicket> requestUpload(@Parameter(description = "Supported API version: v1.") String apiVersion,
            @Parameter(description = "Asset id identifier.") UUID assetId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid UploadRequest request);

    @Operation(operationId = "mediaAdminApi_getUpload", summary = "Get upload - media admin", description = "Get upload for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    UploadStatus getUpload(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Upload id identifier.") UUID uploadId);

    @Operation(operationId = "mediaAdminApi_completeUpload", summary = "Complete upload - media admin", description = "Validate an uploaded incoming object and copy it to an immutable assets key, creating the media version. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaVersionResult completeUpload(@Parameter(description = "Upload id identifier.") UUID uploadId);

    @Operation(operationId = "mediaAdminApi_activateVersion", summary = "Activate version - media admin", description = "Activate a version using the supplied expectedVersion for optimistic concurrency. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaAssetDetails activateVersion(@Parameter(description = "Asset id identifier.") UUID assetId,
            @Parameter(description = "Version id identifier.") UUID versionId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid ExpectedVersionRequest request);

    @Operation(operationId = "mediaAdminApi_registerImport", summary = "Register import - media admin", description = "Register an existing object-storage object as a media version. Returns 201 for a new version, or 200 when the asset already has these bytes. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "201", headers = @Header(name = "Location", description = "URI of the created asset or upload status resource.", schema = @Schema(type = "string", format = "uri-reference")), description = "Resource created.", useReturnTypeSchema = true)
    })
    ResponseEntity<MediaVersionResult> registerImport(
            @Parameter(description = "Supported API version: v1.") String apiVersion,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid RegisterImportRequest request);

    @Operation(operationId = "mediaAdminApi_findUsages", summary = "Find usages - media admin", description = "Find usages for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules. Unrecognized query parameters are rejected.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaUsageReport findUsages(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Asset id identifier.") UUID assetId,
            @Parameter(description = "Scope.") UsageScopeParameter scope);

    @Operation(operationId = "mediaAdminApi_deprecateAsset", summary = "Deprecate asset - media admin", description = "Deprecate asset for media admin. Requires a valid bearer token with catalog:read; application use cases enforce additional capabilities and domain rules.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    MediaAssetDetails deprecateAsset(@Parameter(description = "Asset id identifier.") UUID assetId,
            @io.swagger.v3.oas.annotations.parameters.RequestBody(description = "JSON request. Field validation and unknown-property rejection follow the existing request type.", required = true) @Valid DeprecateRequest request);
}
