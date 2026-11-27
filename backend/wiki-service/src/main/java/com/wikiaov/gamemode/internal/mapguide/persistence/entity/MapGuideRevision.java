package com.wikiaov.gamemode.internal.mapguide.persistence.entity;

import com.wikiaov.gamemode.internal.domain.MapGuideContent;
import com.wikiaov.gamemode.internal.domain.RevisionRecord;
import com.wikiaov.platform.RevisionState;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "gamemode", name = "map_guide_revision")
public class MapGuideRevision implements RevisionRecord {
    @Id
    private UUID id;

    private UUID modeId;

    private long revisionNo;

    @Enumerated(EnumType.STRING)
    private RevisionState state;

    private long version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private MapGuideContent content;

    private UUID sourceRevisionId;

    private String changeNote;

    private Instant publishedAt;

    private Instant createdAt;

    private String createdByIssuer;

    private String createdBySubject;

    private Instant updatedAt;

    private String updatedByIssuer;

    private String updatedBySubject;

    @Override
    public void touch(String issuer, String subject, Instant at) {
        updatedByIssuer = issuer;
        updatedBySubject = subject;
        updatedAt = at;
    }
}
