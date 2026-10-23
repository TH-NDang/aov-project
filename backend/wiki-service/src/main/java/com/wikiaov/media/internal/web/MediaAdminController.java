package com.wikiaov.media.internal.web;

import com.wikiaov.media.MediaSemanticType;
import com.wikiaov.media.internal.application.response.MediaAssetDetails;
import com.wikiaov.media.internal.application.response.MediaAssetSummary;
import com.wikiaov.media.internal.application.response.MediaUsageReport;
import com.wikiaov.media.internal.application.response.MediaVersionResult;
import com.wikiaov.media.internal.application.response.UploadStatus;
import com.wikiaov.media.internal.application.response.UploadTicket;
import com.wikiaov.media.internal.asset.application.ActivateMediaAssetVersion;
import com.wikiaov.media.internal.asset.application.CreateMediaAsset;
import com.wikiaov.media.internal.asset.application.DeprecateMediaAsset;
import com.wikiaov.media.internal.ingestion.application.RegisterExistingObject;
import com.wikiaov.media.internal.query.application.FindMediaUsages;
import com.wikiaov.media.internal.query.application.MediaAssetQueries;
import com.wikiaov.media.internal.upload.application.CompleteMediaUpload;
import com.wikiaov.media.internal.upload.application.RequestMediaUpload;
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

@RestController
@RequestMapping(ApiPaths.ADMIN + "/media")
class MediaAdminController implements MediaAdminApi {

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
    public ResponseEntity<MediaAssetDetails> createAsset(@PathVariable String apiVersion,
            @RequestBody CreateAssetRequest request) {
        MediaAssetDetails asset = createMediaAsset.execute(
                new CreateMediaAsset.Command(request.semanticType(), SourceRequest.toInput(request.source())));
        return ResponseEntity.created(assetUri(apiVersion, asset.id())).body(asset);
    }

    @GetMapping(path = "/assets", version = "1")
    public PageSlice<MediaAssetSummary> listAssets(HttpServletRequest http,
            @RequestParam(required = false) @Nullable MediaSemanticType semanticType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        QueryParameters.requireOnly(http, Set.of("semanticType", "page", "size"));
        return queries.list(semanticType, page, size);
    }

    @GetMapping(path = "/assets/{assetId}", version = "1")
    public MediaAssetDetails getAsset(HttpServletRequest http, @PathVariable UUID assetId) {
        QueryParameters.requireOnly(http, Set.of());
        return queries.get(assetId);
    }

    @PostMapping(path = "/assets/{assetId}/version-uploads", version = "1")
    public ResponseEntity<UploadTicket> requestUpload(@PathVariable String apiVersion, @PathVariable UUID assetId,
            @RequestBody UploadRequest request) {
        UploadTicket ticket = requestMediaUpload.execute(new RequestMediaUpload.Command(assetId, request.fileName(),
                request.contentType(), request.sizeBytes()));
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ApiPaths.ADMIN + "/media/uploads/{uploadId}")
                .buildAndExpand(apiVersion, ticket.uploadId())
                .toUri();
        return ResponseEntity.created(location).body(ticket);
    }

    @GetMapping(path = "/uploads/{uploadId}", version = "1")
    public UploadStatus getUpload(HttpServletRequest http, @PathVariable UUID uploadId) {
        QueryParameters.requireOnly(http, Set.of());
        return queries.upload(uploadId);
    }

    @PostMapping(path = "/uploads/{uploadId}/complete", version = "1")
    public MediaVersionResult completeUpload(@PathVariable UUID uploadId) {
        return completeMediaUpload.execute(uploadId);
    }

    @PostMapping(path = "/assets/{assetId}/versions/{versionId}/activate", version = "1")
    public MediaAssetDetails activateVersion(@PathVariable UUID assetId, @PathVariable UUID versionId,
            @RequestBody ExpectedVersionRequest request) {
        return activateMediaAssetVersion.execute(assetId, versionId, request.expectedVersion());
    }

    @PostMapping(path = "/imports/register", version = "1")
    public ResponseEntity<MediaVersionResult> registerImport(@PathVariable String apiVersion,
            @RequestBody RegisterImportRequest request) {
        MediaVersionResult result = registerExistingObject.execute(new RegisterExistingObject.Command(
                request.assetId(), request.objectKey(), SourceRequest.toInput(request.source())));
        return result.duplicate()
                ? ResponseEntity.ok(result)
                : ResponseEntity.created(assetUri(apiVersion, result.assetId())).body(result);
    }

    @GetMapping(path = "/assets/{assetId}/usages", version = "1")
    public MediaUsageReport findUsages(HttpServletRequest http, @PathVariable UUID assetId,
            @RequestParam(defaultValue = "ANY") UsageScopeParameter scope) {
        QueryParameters.requireOnly(http, Set.of("scope"));
        return findMediaUsages.execute(assetId, scope.toScope());
    }

    @PostMapping(path = "/assets/{assetId}/deprecate", version = "1")
    public MediaAssetDetails deprecateAsset(@PathVariable UUID assetId, @RequestBody DeprecateRequest request) {
        return deprecateMediaAsset.execute(assetId, request.expectedVersion(), request.reason());
    }

    private static URI assetUri(String apiVersion, UUID assetId) {
        return ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(ApiPaths.ADMIN + "/media/assets/{assetId}")
                .buildAndExpand(apiVersion, assetId)
                .toUri();
    }
}
