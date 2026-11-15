package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.source.application.SourceCollections;
import com.wikiaov.media.internal.source.application.SourceFileViews;
import com.wikiaov.media.internal.source.application.SourceFiles;
import com.wikiaov.media.internal.source.application.SourceLinks;
import com.wikiaov.media.internal.source.application.SourceOrphans;
import com.wikiaov.media.internal.source.application.SourceUploads;
import com.wikiaov.media.internal.source.domain.SourceCategory;
import com.wikiaov.media.internal.web.request.ExpectedVersionRequest;
import com.wikiaov.media.internal.web.request.SourceRequests;
import com.wikiaov.platform.ApiPaths;
import com.wikiaov.platform.PageSlice;
import com.wikiaov.platform.QueryParameters;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Set;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(ApiPaths.ADMIN)
class SourceFileAdminController implements SourceFileAdminApi {

    private final SourceCollections collections;
    private final SourceFiles files;
    private final SourceUploads uploads;
    private final SourceLinks links;
    private final SourceOrphans orphans;

    SourceFileAdminController(SourceCollections collections, SourceFiles files, SourceUploads uploads,
            SourceLinks links, SourceOrphans orphans) {
        this.collections = collections;
        this.files = files;
        this.uploads = uploads;
        this.links = links;
        this.orphans = orphans;
    }

    @GetMapping(path = "/source-collections", version = "1")
    public PageSlice<SourceFileViews.Collection> listCollections(HttpServletRequest http,
            @RequestParam(required = false) @Nullable SourceCategory category,
            @RequestParam(required = false) @Nullable String q, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        QueryParameters.requireOnly(http, Set.of("category", "q", "page", "size"));
        return collections.list(category, q, page, size);
    }

    @GetMapping(path = "/source-collections/{collectionId}", version = "1")
    public SourceFileViews.Collection getCollection(HttpServletRequest http, @PathVariable UUID collectionId) {
        QueryParameters.requireOnly(http, Set.of());
        return collections.get(collectionId);
    }

    @PostMapping(path = "/source-collections", version = "1")
    public ResponseEntity<SourceFileViews.Collection> createCollection(
            @RequestBody SourceRequests.CreateCollection body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(collections.create(body.code(), body.category(),
                body.label(), body.note(), body.capturedOn()));
    }

    @PutMapping(path = "/source-collections/{collectionId}", version = "1")
    public SourceFileViews.Collection updateCollection(@PathVariable UUID collectionId,
            @RequestBody SourceRequests.UpdateCollection body) {
        return collections.update(collectionId, body.expectedVersion(), body.label(), body.note(), body.capturedOn());
    }

    @PostMapping(path = "/source-collections/{collectionId}/delete", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteCollection(@PathVariable UUID collectionId, @RequestBody ExpectedVersionRequest body) {
        collections.delete(collectionId, body.expectedVersion());
    }

    @GetMapping(path = "/source-collections/{collectionId}/files", version = "1")
    public PageSlice<SourceFileViews.File> listFiles(HttpServletRequest http, @PathVariable UUID collectionId,
            @RequestParam(required = false) @Nullable String prefix,
            @RequestParam(required = false) @Nullable String q, @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        QueryParameters.requireOnly(http, Set.of("prefix", "q", "page", "size"));
        return files.list(collectionId, prefix, q, page, size);
    }

    @GetMapping(path = "/source-files/{fileId}", version = "1")
    public SourceFileViews.FileDetails getFile(HttpServletRequest http, @PathVariable UUID fileId) {
        QueryParameters.requireOnly(http, Set.of());
        return files.details(fileId);
    }

    @PostMapping(path = "/source-files/{fileId}/delete", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFile(@PathVariable UUID fileId, @RequestBody ExpectedVersionRequest body) {
        files.delete(fileId, body.expectedVersion());
    }

    @PostMapping(path = "/source-collections/{collectionId}/uploads", version = "1")
    public ResponseEntity<SourceFileViews.UploadResult> requestUpload(@PathVariable UUID collectionId,
            @RequestBody SourceRequests.Upload body) {
        SourceUploads.Replace replace = body.replace() == null
                ? null
                : new SourceUploads.Replace(body.replace().fileId(), body.replace().expectedVersion());
        SourceFileViews.UploadResult result = uploads.request(collectionId, body.path(), body.sha256(),
                body.sizeBytes(), body.contentType(), replace);

        HttpStatus status = result.status() == SourceFileViews.UploadStatus.STORED ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(result);
    }

    @GetMapping(path = "/source-uploads/{uploadId}", version = "1")
    public SourceFileViews.Upload getUpload(HttpServletRequest http, @PathVariable UUID uploadId) {
        QueryParameters.requireOnly(http, Set.of());
        return uploads.status(uploadId);
    }

    @PostMapping(path = "/source-uploads/{uploadId}/complete", version = "1")
    public SourceFileViews.Completed completeUpload(@PathVariable UUID uploadId) {
        return uploads.complete(uploadId);
    }

    @PostMapping(path = "/source-files/links", version = "1")
    public ResponseEntity<SourceFileViews.Links> linksBySha256(@RequestBody SourceRequests.LinksBySha256 body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(links.bySha256(body.sha256()));
    }

    @PostMapping(path = "/source-collections/{collectionId}/links", version = "1")
    public ResponseEntity<SourceFileViews.PathLinks> linksByPath(@PathVariable UUID collectionId,
            @RequestBody SourceRequests.LinksByPath body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(links.byPaths(collectionId, body.paths()));
    }

    @PostMapping(path = "/source-files/{fileId}/download-link", version = "1")
    public ResponseEntity<SourceFileViews.Download> downloadLink(@PathVariable UUID fileId) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(links.download(fileId));
    }

    @GetMapping(path = "/source-objects/orphans", version = "1")
    public PageSlice<SourceFileViews.Orphan> listOrphans(HttpServletRequest http,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "50") int size) {
        QueryParameters.requireOnly(http, Set.of("page", "size"));
        return orphans.list(page, size);
    }

    @PostMapping(path = "/source-objects/{sha256}/delete", version = "1")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteOrphan(@PathVariable String sha256) {
        orphans.delete(sha256);
    }
}
