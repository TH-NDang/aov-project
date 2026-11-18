package com.wikiaov.video.internal.application;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.jspecify.annotations.Nullable;

/** What the video endpoints accept. The schema names stay those of the former nested records of {@code SubjectVideos}. */
public final class VideoCommands {
    private VideoCommands() {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.AdminFilter")
    public record AdminFilter(
            @Nullable VideoSubjectKind subjectKind,
            @Nullable UUID subjectId,
            @Nullable String subjectKey,
            @Nullable VideoStatus status,
            @Nullable VideoPurpose purpose,
            @Nullable VideoOrigin origin,
            @Nullable String q
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.SaveVideo")
    public record SaveVideo(
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            @Nullable String note,
            String url,
            @Nullable Integer startSeconds,
            @Nullable Integer durationSeconds,
            @Nullable String channelName,
            @Nullable LocalDate publishedOn,
            @Nullable UUID patchVariantId,
            @Nullable Integer displayOrder,
            VideoStatus status,
            @Nullable Long expectedVersion
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.ImportVideo")
    public record ImportVideo(
            VideoSubjectKind subjectKind,
            UUID subjectId,
            @Nullable String subjectKey,
            VideoPurpose purpose,
            String title,
            String url,
            @Nullable Integer durationSeconds,
            @Nullable LocalDate publishedOn,
            @Nullable Integer displayOrder,
            VideoStatus status
    ) {
    }

    @Schema(name = "com.wikiaov.video.internal.application.SubjectVideos.ImportVideos")
    public record ImportVideos(
            List<ImportVideo> items
    ) {
    }
}
