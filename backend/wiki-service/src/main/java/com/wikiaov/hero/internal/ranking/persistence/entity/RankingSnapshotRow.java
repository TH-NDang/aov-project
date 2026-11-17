package com.wikiaov.hero.internal.ranking.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One capture of the game's hero ranking boards for one filter (ADR-025). */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "ranking_snapshot")
public class RankingSnapshotRow extends AssignedIdentifierEntity<UUID> {
    @Id
    private UUID id;

    private String code;
    private String regionCode;
    private String modeCode;
    private String modeLabel;
    private String periodLabel;
    private Instant capturedAt;
    private String sourceTimeZone;
    private String sourceRun;
    private String sourceNote;
    private Instant confirmedAt;
    private String confirmedByIssuer;
    private String confirmedBySubject;
    private long version;
    private Instant createdAt;
    private String createdByIssuer;
    private String createdBySubject;
    private Instant updatedAt;
}
