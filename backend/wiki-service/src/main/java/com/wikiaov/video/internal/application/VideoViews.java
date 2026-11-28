package com.wikiaov.video.internal.application;

import com.wikiaov.video.VideoSubject;
import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoProvider;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the video endpoints answer. The schema names stay those of the former nested records of {@code SubjectVideos}. */
public final class VideoViews {
    private VideoViews() {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.PublicVideo")
    public record PublicVideo(
            UUID id,
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            VideoProvider provider,
            @Nullable String providerVideoId,
            int startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable Instant publishedAt,
            @Nullable String locale,
            @Nullable UUID patchVariantId
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.PublicVideoList")
    public record PublicVideoList(
            List<PublicVideo> items
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.AdminVideo")
    public record AdminVideo(
            UUID id,
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            VideoProvider provider,
            @Nullable String providerVideoId,
            int startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable Instant publishedAt,
            @Nullable String locale,
            @Nullable UUID patchVariantId,
            int displayOrder,
            VideoStatus status,
            VideoOrigin origin,
            long version,
            Instant createdAt,
            Instant updatedAt
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.ImportRejection")
    public record ImportRejection(
            int index,
            String reason
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.ImportResult")
    public record ImportResult(
            int created,
            int skipped,
            List<ImportRejection> rejected
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.SubjectList")
    public record SubjectList(
            List<VideoSubject> items
    ) {
    }
}
