package com.wikiaov.video.internal.persistence.entity;

import com.wikiaov.video.VideoSubjectKind;
import com.wikiaov.video.internal.domain.VideoOrigin;
import com.wikiaov.video.internal.domain.VideoProvider;
import com.wikiaov.video.internal.domain.VideoPurpose;
import com.wikiaov.video.internal.domain.VideoStatus;
import jakarta.persistence.*;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "video", name = "subject_video")
public class SubjectVideo {
    @Id
    private UUID id;

    @Enumerated(EnumType.STRING)
    private VideoSubjectKind subjectKind;

    private UUID subjectId;

    private String subjectKey;

    @Enumerated(EnumType.STRING)
    private VideoPurpose purpose;

    private String title;

    private String note;

    private String url;

    @Enumerated(EnumType.STRING)
    private VideoProvider provider;

    private String providerVideoId;

    private int startSeconds;

    private Integer durationSeconds;

    private String channelName;

    private LocalDate publishedOn;

    private UUID patchVariantId;

    private int displayOrder;

    @Enumerated(EnumType.STRING)
    private VideoStatus status;

    @Enumerated(EnumType.STRING)
    private VideoOrigin origin;

    private long version;

    private Instant createdAt;

    private Instant updatedAt;
}
