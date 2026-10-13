package com.wikiaov.media.internal.web;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaAssetSummary;
import com.wikiaov.media.internal.application.response.MediaUsageReport;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.application.response.UploadStatus;
import com.wikiaov.media.internal.application.response.UploadTicket;
import com.wikiaov.media.internal.application.service.ActivateMediaAssetVersion;
import com.wikiaov.media.internal.application.service.CompleteMediaUpload;
import com.wikiaov.media.internal.application.service.CreateMediaAsset;
import com.wikiaov.media.internal.application.service.DeprecateMediaAsset;
import com.wikiaov.media.internal.application.service.FindMediaUsages;
import com.wikiaov.media.internal.application.service.MediaAssetQueries;
import com.wikiaov.media.internal.application.service.RegisterExistingObject;
import com.wikiaov.media.internal.application.service.RequestMediaUpload;
import com.wikiaov.media.internal.web.request.CreateAssetRequest;
import com.wikiaov.media.internal.web.request.DeprecateRequest;
import com.wikiaov.media.internal.web.request.ExpectedVersionRequest;
import com.wikiaov.media.internal.web.request.RegisterImportRequest;
import com.wikiaov.media.internal.web.request.SourceRequest;
import com.wikiaov.media.internal.web.request.UploadRequest;
import com.wikiaov.media.internal.web.request.UsageScopeParameter;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

/**
 * Admin media API (03 part E). Every route needs {@code catalog:read} (URL rule); the use cases additionally
 * require {@code media:write} for changes.
 */
@RestController
@RequestMapping(ApiPaths.ADMIN + "/media")
class MediaAdminController {

    private final CreateMediaAsset createMediaAsset;
    private final RequestMediaUpload requestMediaUpload;
    private final CompleteMediaUpload completeMediaUpload;
    private final RegisterExistingObject registerExistingObject;
    private final ActivateMediaAssetVersion activateMediaAssetVersion;
    private final DeprecateMediaAsset deprecateMediaAsset;
    private final FindMediaUsages findMediaUsages;
    private final MediaAssetQueries queries;

    MediaAdminController(CreateMediaAsset createMediaAsset, RequestMediaUpload requestMediaUpload,
            CompleteMediaUpload completeMediaUpload, RegisterExistingObject registerExistingObject,
            ActivateMediaAssetVersion activateMediaAssetVersion, DeprecateMediaAsset deprecateMediaAsset,
            FindMediaUsages findMediaUsages, MediaAssetQueries queries) {
        this.createMediaAsset = createMediaAsset;
        this.requestMediaUpload = requestMediaUpload;
        this.completeMediaUpload = completeMediaUpload;
        this.registerExistingObject = registerExistingObject;
        this.activateMediaAssetVersion = activateMediaAssetVersion;
        this.deprecateMediaAsset = deprecateMediaAsset;
        this.findMediaUsages = findMediaUsages;
        this.queries = queries;
    }

    @PostMapping(path = "/assets", version = "1")
    ResponseEntity<MediaAssetDetails> createAsset(@PathVariable String apiVersion,
            @Valid @RequestBody CreateAssetRequest request) {
        MediaAssetDetails asset = createMediaAsset.execute(
                new CreateMediaAsset.Command(request.semanticType(), SourceRequest.toInput(request.source())));
        return ResponseEntity.created(assetUri(apiVersion, asset.id())).body(asset);
    }

    @GetMapping(path = "/assets", version = "1")
    PageSlice<MediaAssetSummary> listAssets(HttpServletRequest http,
            @RequestParam(required = false) @Nullable MediaSemanticType semanticType,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        QueryParameters.requireOnly(http, Set.of("semanticType", "page", "size"));
        return queries.list(semanticType, page, size);
    }

    @GetMapping(path = "/assets/{assetId}", version = "1")
    MediaAssetDetails getAsset(HttpServletRequest http, @PathVariable UUID assetId) {
        QueryParameters.requireOnly(http, Set.of());
        return queries.get(assetId);
    }

    @PostMapping(path = "/assets/{assetId}/version-uploads", version = "1")
    ResponseEntity<UploadTicket> requestUpload(@PathVariable String apiVersion, @PathVariable UUID assetId,
            @Valid @RequestBody UploadRequest request) {
        UploadTicket ticket = requestMediaUpload.execute(new RequestMediaUpload.Command(assetId, request.fileName(),
                request.contentType(), request.sizeBytes()));
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ApiPaths.ADMIN + "/media/uploads/{uploadId}")
                .buildAndExpand(apiVersion, ticket.uploadId())
                .toUri();
        return ResponseEntity.created(location).body(ticket);
    }

    @GetMapping(path = "/uploads/{uploadId}", version = "1")
    UploadStatus getUpload(HttpServletRequest http, @PathVariable UUID uploadId) {
        QueryParameters.requireOnly(http, Set.of());
        return queries.upload(uploadId);
    }

    @PostMapping(path = "/uploads/{uploadId}/complete", version = "1")
    MediaVersionResult completeUpload(@PathVariable UUID uploadId) {
        return completeMediaUpload.execute(uploadId);
    }

    @PostMapping(path = "/assets/{assetId}/versions/{versionId}/activate", version = "1")
    MediaAssetDetails activateVersion(@PathVariable UUID assetId, @PathVariable UUID versionId,
            @Valid @RequestBody ExpectedVersionRequest request) {
        return activateMediaAssetVersion.execute(assetId, versionId, request.expectedVersion());
    }

    /** 201 when a version was created, 200 when the asset already had these bytes. */
    @PostMapping(path = "/imports/register", version = "1")
    ResponseEntity<MediaVersionResult> registerImport(@PathVariable String apiVersion,
            @Valid @RequestBody RegisterImportRequest request) {
        MediaVersionResult result = registerExistingObject.execute(new RegisterExistingObject.Command(
                request.assetId(), request.objectKey(), SourceRequest.toInput(request.source())));
        return result.duplicate()
                ? ResponseEntity.ok(result)
                : ResponseEntity.created(assetUri(apiVersion, result.assetId())).body(result);
    }

    @GetMapping(path = "/assets/{assetId}/usages", version = "1")
    MediaUsageReport findUsages(HttpServletRequest http, @PathVariable UUID assetId,
            @RequestParam(defaultValue = "ANY") UsageScopeParameter scope) {
        QueryParameters.requireOnly(http, Set.of("scope"));
        return findMediaUsages.execute(assetId, scope.toScope());
    }

    @PostMapping(path = "/assets/{assetId}/deprecate", version = "1")
    MediaAssetDetails deprecateAsset(@PathVariable UUID assetId, @Valid @RequestBody DeprecateRequest request) {
        return deprecateMediaAsset.execute(assetId, request.expectedVersion(), request.reason());
    }

    private static URI assetUri(String apiVersion, UUID assetId) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ApiPaths.ADMIN + "/media/assets/{assetId}")
                .buildAndExpand(apiVersion, assetId)
                .toUri();
    }
}
