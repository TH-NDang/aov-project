package com.wikiaov.gamemode.internal.lineup.persistence.entity;

import com.wikiaov.gamemode.internal.domain.AutoChessContent.LineupUnit;
import com.wikiaov.gamemode.internal.lineup.domain.LineupStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Getter
@Setter
@Table(schema = "gamemode", name = "community_lineup")
public class CommunityLineup {
    @Id
    private UUID id;

    private UUID modeId;

    private String authorIssuer;

    private String authorSubject;

    private String name;

    private String note;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<LineupUnit> units;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private List<String> emblems;

    @Enumerated(EnumType.STRING)
    private LineupStatus status;

    private String hiddenReason;

    private long version;

    private Instant createdAt;

    private Instant updatedAt;

    public boolean authoredBy(String issuer, String subject) {
        return authorIssuer.equals(issuer) && authorSubject.equals(subject);
    }
}
