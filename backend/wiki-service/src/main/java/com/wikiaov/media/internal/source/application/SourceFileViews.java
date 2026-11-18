package com.wikiaov.media.internal.source.application;

import com.wikiaov.media.SourceFileUsage;
import com.wikiaov.media.internal.domain.model.UploadState;
import com.wikiaov.media.internal.source.domain.SourceCategory;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** Response bodies of the source file API (03, ADR-030 section). */
public final class SourceFileViews {

    private SourceFileViews() {
    }

    public record Collection(
            UUID id,
            String code,
            SourceCategory category,
            String label,
            @Nullable String note,
            @Nullable LocalDate capturedOn,
            long fileCount,
            long totalBytes,
            Instant updatedAt,
            long version
    ) {
    }

    public record File(
            UUID id,
            String path,
            String sha256,
            long sizeBytes,
            String contentType,
            Instant createdAt,
            Instant updatedAt,
            long version
    ) {
    }

    public record CollectionRef(
            UUID id,
            String code,
            SourceCategory category,
            String label
    ) {
    }

    public record Place(
            UUID fileId,
            String collectionCode,
            String path
    ) {
    }

    public record FileDetails(
            UUID id,
            String path,
            String sha256,
            long sizeBytes,
            String contentType,
            Instant createdAt,
            Instant updatedAt,
            long version,
            CollectionRef collection,
            List<Place> otherPlaces,
            List<SourceFileUsage> usages
    ) {
    }

    /** {@code STORED}: the file is in the collection now. {@code UPLOAD_REQUIRED}: PUT the bytes, then complete. */
    public enum UploadStatus {
        STORED,
        UPLOAD_REQUIRED
    }

    public record Ticket(
            UUID uploadId,
            String method,
            String uploadUrl,
            Map<String, String> headers,
            Instant expiresAt
    ) {
    }

    public record UploadResult(
            UploadStatus status,
            @Nullable File file,
            @Nullable Ticket upload
    ) {
    }

    public record Upload(
            UUID uploadId,
            UUID collectionId,
            String path,
            UploadState state,
            @Nullable String errorCode,
            Instant expiresAt,
            @Nullable UUID fileId
    ) {
    }

    public record Completed(
            File file
    ) {
    }

    public record Link(
            String sha256,
            String url,
            Instant expiresAt,
            String contentType,
            long sizeBytes
    ) {
    }

    public record Links(
            List<Link> items,
            List<String> missing
    ) {
    }

    public record PathLink(
            String path,
            String sha256,
            String url,
            Instant expiresAt,
            String contentType,
            long sizeBytes
    ) {
    }

    public record PathLinks(
            List<PathLink> items,
            List<String> missing
    ) {
    }

    public record Download(
            String url,
            Instant expiresAt
    ) {
    }

    public record Orphan(
            String sha256,
            long sizeBytes,
            String contentType,
            String firstPath,
            Instant createdAt,
            String state
    ) {
    }
}
