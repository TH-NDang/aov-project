package com.wikiaov.hero.internal.ranking.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** One value of a hero in a snapshot, with the text read off the screenshot and the area it was read from. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "ranking_snapshot_value")
@IdClass(RankingSnapshotValueRow.Key.class)
public class RankingSnapshotValueRow extends AssignedIdentifierEntity<RankingSnapshotValueRow.Key> {
    @Id
    private UUID snapshotId;

    @Id
    private UUID heroId;

    @Id
    private String metric;

    private BigDecimal numberValue;
    private String tierValue;
    private UUID heroValue;
    private String readText;
    private boolean needsReview;
    private String note;
    private String imageId;

    // The default naming joins a one-letter word to the one before it, so these name their columns.
    @Column(name = "box_x")
    private Integer boxX;

    @Column(name = "box_y")
    private Integer boxY;

    private Integer boxWidth;
    private Integer boxHeight;
    private Instant reviewedAt;
    private String reviewedByIssuer;
    private String reviewedBySubject;
    private long version;
    private Instant updatedAt;

    @Override
    public Key getId() {
        return new Key(snapshotId, heroId, metric);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID snapshotId;
        public UUID heroId;
        public String metric;
    }
}
