package com.wikiaov.media.internal.source.application;

import com.wikiaov.media.internal.application.MediaErrorCode;
import com.wikiaov.media.internal.source.domain.SourceDigest;
import com.wikiaov.media.internal.source.domain.SourcePaths;
import com.wikiaov.platform.ApiException;
import com.wikiaov.platform.ApiFieldError;
import com.wikiaov.platform.PlatformErrorCode;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Errors of the source file capability, mapped to the media error codes of 03 (ADR-030 section). */
final class SourceErrors {

    private SourceErrors() {
    }

    static String requirePath(@Nullable String path, String field) {
        return SourcePaths.normalize(path).orElseThrow(() -> invalidPath(field));
    }

    static String requireSha256(@Nullable String sha256, String field) {
        if (sha256 == null || !SourceDigest.isSha256(sha256)) {
            throw new ApiException(PlatformErrorCode.INVALID_REQUEST, "A SHA-256 must be 64 lower-case hex digits.",
                    List.of(new ApiFieldError(field, "PATTERN", "must be 64 lower-case hex digits")));
        }
        return sha256;
    }

    static ApiException invalidPath(String field) {
        return new ApiException(PlatformErrorCode.INVALID_REQUEST,
                "A path is relative, uses / between folders and has no empty, '.' or '..' segment.",
                List.of(new ApiFieldError(field, "SOURCE_FILE_PATH_INVALID", "is not a valid relative path")));
    }

    static ApiException collectionNotFound(UUID id) {
        return new ApiException(MediaErrorCode.SOURCE_COLLECTION_NOT_FOUND,
                "Source collection " + id + " does not exist.");
    }

    static ApiException collectionVersionConflict(long currentVersion) {
        return new ApiException(MediaErrorCode.SOURCE_COLLECTION_VERSION_CONFLICT,
                "The source collection was modified by another request.", Map.of("currentVersion", currentVersion));
    }

    static ApiException fileNotFound(UUID id) {
        return new ApiException(MediaErrorCode.SOURCE_FILE_NOT_FOUND, "Source file " + id + " does not exist.");
    }

    static ApiException fileVersionConflict(@Nullable Long currentVersion) {
        String detail = "The source file was modified or removed by another request.";
        return currentVersion == null
                ? new ApiException(MediaErrorCode.SOURCE_FILE_VERSION_CONFLICT, detail)
                : new ApiException(MediaErrorCode.SOURCE_FILE_VERSION_CONFLICT, detail,
                        Map.of("currentVersion", currentVersion));
    }

    static ApiException pathTaken(UUID fileId, String sha256, long version) {
        return new ApiException(MediaErrorCode.SOURCE_FILE_PATH_TAKEN,
                "The path already names other bytes; replace the file explicitly.",
                Map.of("fileId", fileId, "sha256", sha256, "version", version));
    }

    static ApiException objectBusy() {
        return new ApiException(MediaErrorCode.SOURCE_OBJECT_BUSY,
                "The same bytes are being deleted right now; retry in a moment.");
    }

    static ApiException uploadNotFound(UUID id) {
        return new ApiException(MediaErrorCode.SOURCE_UPLOAD_NOT_FOUND, "Source upload " + id + " does not exist.");
    }

    static ApiException uploadExpired(Instant expiresAt) {
        return new ApiException(MediaErrorCode.SOURCE_UPLOAD_EXPIRED, "The upload expired; request a new upload.",
                Map.of("expiresAt", expiresAt.toString()));
    }

    static ApiException uploadRejected(String reason) {
        return new ApiException(MediaErrorCode.SOURCE_UPLOAD_REJECTED,
                "The uploaded bytes do not match what was declared; request a new upload.", Map.of("reason", reason));
    }

    static ApiException uploadInProgress() {
        return new ApiException(MediaErrorCode.SOURCE_UPLOAD_IN_PROGRESS,
                "Another request is completing this upload; check its status and retry later.");
    }

    static ApiException notUploaded() {
        return new ApiException(MediaErrorCode.SOURCE_UPLOAD_NOT_UPLOADED,
                "The bytes have not been uploaded yet; PUT them to the upload URL, then complete again.");
    }
}
