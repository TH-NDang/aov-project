package com.wikiaov.hero.internal.ranking.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/** A screenshot of a snapshot, addressed by the SHA-256 of its file; the bytes stay outside the database. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "ranking_snapshot_image")
@IdClass(RankingSnapshotImageRow.Key.class)
public class RankingSnapshotImageRow extends AssignedIdentifierEntity<RankingSnapshotImageRow.Key> {
    @Id
    private UUID snapshotId;

    @Id
    private String imageId;

    private String board;
    private int pageNo;
    private String fileName;
    private int width;
    private int height;

    @Override
    public Key getId() {
        return new Key(snapshotId, imageId);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID snapshotId;
        public String imageId;
    }
}
