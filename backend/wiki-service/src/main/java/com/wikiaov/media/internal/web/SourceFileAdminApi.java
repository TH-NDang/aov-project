package com.wikiaov.media.internal.web;

import com.wikiaov.media.internal.source.application.SourceCommands;
import com.wikiaov.media.internal.source.application.SourceFileViews;
import com.wikiaov.media.internal.source.domain.SourceCategory;
import com.wikiaov.media.internal.web.request.ExpectedVersionRequest;
import com.wikiaov.platform.PageSlice;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.util.UUID;
import org.jspecify.annotations.Nullable;
import org.springframework.http.ResponseEntity;

/**
 * Private source files: evidence captures and import data (03, ADR-030). Reading needs {@code catalog:read}; changes
 * need {@code media:write}. Presigned URLs in these responses are short-lived and never reach public clients.
 */
@Tag(name = "source files admin")
public interface SourceFileAdminApi {
    @Operation(operationId = "sourceFileAdminApi_listCollections", summary = "List source collections", description = "Collections by category, newest capture first, with their file count and bytes. Requires catalog:read. Only category, q, page and size query parameters are accepted.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SourceFileViews.Collection> listCollections(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Only collections of this category.") @Nullable SourceCategory category,
            @Parameter(description = "Text found in the code or label, ignoring case.") @Nullable @Size(max = 200) String q,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 50.") @Min(1) @Max(100) int size);

    @Operation(operationId = "sourceFileAdminApi_getCollection", summary = "Read a source collection", description = "One collection with its file count and bytes. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SourceFileViews.Collection getCollection(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Collection identifier.") UUID collectionId);

    @Operation(operationId = "sourceFileAdminApi_createCollection", summary = "Create a source collection", description = "A new collection of one function, such as one capture run. Its code and category never change. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "201", description = "Created.", useReturnTypeSchema = true)
    })
    ResponseEntity<SourceFileViews.Collection> createCollection(@Valid SourceCommands.CreateCollectionCommand body);

    @Operation(operationId = "sourceFileAdminApi_updateCollection", summary = "Describe a source collection", description = "Changes the label, note and capture day. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SourceFileViews.Collection updateCollection(@Parameter(description = "Collection identifier.") UUID collectionId,
            @Valid SourceCommands.UpdateCollectionCommand body);

    @Operation(operationId = "sourceFileAdminApi_deleteCollection", summary = "Delete a source collection", description = "Removes the collection and its files from the catalog. The bytes stay stored and become orphans when nothing else uses them. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void deleteCollection(@Parameter(description = "Collection identifier.") UUID collectionId,
            @Valid ExpectedVersionRequest body);

    @Operation(operationId = "sourceFileAdminApi_listFiles", summary = "List files of a source collection", description = "Files ordered by path, with the size and type of their bytes. Requires catalog:read. Only prefix, q, page and size query parameters are accepted.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SourceFileViews.File> listFiles(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Collection identifier.") UUID collectionId,
            @Parameter(description = "Folder; every file below it is listed.") @Nullable @Size(max = 512) String prefix,
            @Parameter(description = "Text found in the path, ignoring case.") @Nullable @Size(max = 200) String q,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 200; default 50.") @Min(1) @Max(200) int size);

    @Operation(operationId = "sourceFileAdminApi_getFile", summary = "Read a source file", description = "The file, its collection, other places of the same bytes and the records that use it as evidence. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SourceFileViews.FileDetails getFile(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "File identifier.") UUID fileId);

    @Operation(operationId = "sourceFileAdminApi_deleteFile", summary = "Remove a source file", description = "Removes the file from its collection only; the bytes stay stored until they are purged as orphans. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void deleteFile(@Parameter(description = "File identifier.") UUID fileId, @Valid ExpectedVersionRequest body);

    @Operation(operationId = "sourceFileAdminApi_requestUpload", summary = "Request a source file upload", description = "Bytes already stored are placed at once (STORED). Otherwise returns a presigned PUT (UPLOAD_REQUIRED); upload the bytes directly to storage, then complete. A path that names other bytes needs an explicit replace. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "The file is in the collection.", useReturnTypeSchema = true),
            @ApiResponse(responseCode = "201", description = "Upload the bytes, then complete.", useReturnTypeSchema = true)
    })
    ResponseEntity<SourceFileViews.UploadResult> requestUpload(
            @Parameter(description = "Collection identifier.") UUID collectionId,
            @Valid SourceCommands.UploadCommand body);

    @Operation(operationId = "sourceFileAdminApi_getUpload", summary = "Read a source file upload", description = "State of an upload. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SourceFileViews.Upload getUpload(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Upload identifier.") UUID uploadId);

    @Operation(operationId = "sourceFileAdminApi_completeUpload", summary = "Complete a source file upload", description = "Reads the uploaded bytes once to check SHA-256, size and type, stores them by content and places the file. Safe to retry. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    SourceFileViews.Completed completeUpload(@Parameter(description = "Upload identifier.") UUID uploadId);

    @Operation(operationId = "sourceFileAdminApi_linksBySha256", summary = "Presigned links by SHA-256", description = "Short-lived GET URLs for up to 200 stored files; unknown hashes are listed as missing. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<SourceFileViews.Links> linksBySha256(@Valid SourceCommands.LinksBySha256Command body);

    @Operation(operationId = "sourceFileAdminApi_linksByPath", summary = "Presigned links by path", description = "Short-lived GET URLs for up to 200 files of one collection, for example to read its manifest. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<SourceFileViews.PathLinks> linksByPath(
            @Parameter(description = "Collection identifier.") UUID collectionId,
            @Valid SourceCommands.LinksByPathCommand body);

    @Operation(operationId = "sourceFileAdminApi_downloadLink", summary = "Presigned download link", description = "A short-lived URL that saves the file under its own name. Requires catalog:read.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    ResponseEntity<SourceFileViews.Download> downloadLink(@Parameter(description = "File identifier.") UUID fileId);

    @Operation(operationId = "sourceFileAdminApi_listOrphans", summary = "List orphaned source bytes", description = "Stored bytes that no collection places and no record uses, newest first. Requires catalog:read. Only page and size query parameters are accepted.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "200", description = "Successful operation.", useReturnTypeSchema = true)
    })
    PageSlice<SourceFileViews.Orphan> listOrphans(@Parameter(hidden = true) HttpServletRequest http,
            @Parameter(description = "Zero-based page.") @Min(0) int page,
            @Parameter(description = "Page size, from 1 to 100; default 50.") @Min(1) @Max(100) int size);

    @Operation(operationId = "sourceFileAdminApi_deleteOrphan", summary = "Delete orphaned source bytes", description = "Permanently deletes stored bytes that nothing uses; a call that stopped half way continues. Requires media:write.", security = @SecurityRequirement(name = "bearerAuth"), responses = {
            @ApiResponse(responseCode = "204", description = "Successful operation.")
    })
    void deleteOrphan(@Parameter(description = "Lower-case hex SHA-256 of the bytes.") String sha256);
}
