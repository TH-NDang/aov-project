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

/** A hero or hero form listed in a snapshot, with its name, role and places as the game showed them. */
@Entity
@Getter
@Setter
@NoArgsConstructor
@Table(schema = "hero", name = "ranking_snapshot_hero")
@IdClass(RankingSnapshotHeroRow.Key.class)
public class RankingSnapshotHeroRow extends AssignedIdentifierEntity<RankingSnapshotHeroRow.Key> {
    @Id
    private UUID snapshotId;

    @Id
    private UUID heroId;

    private String nameOnScreen;
    private String roleOnScreen;
    private Integer ratesPosition;
    private Integer figuresPosition;

    @Override
    public Key getId() {
        return new Key(snapshotId, heroId);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID snapshotId;
        public UUID heroId;
    }
}
