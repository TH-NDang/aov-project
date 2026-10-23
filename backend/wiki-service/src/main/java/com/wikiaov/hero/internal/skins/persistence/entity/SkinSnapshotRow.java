package com.wikiaov.hero.internal.skins.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_skin_snapshot")
@IdClass(SkinSnapshotRow.Key.class)
public class SkinSnapshotRow extends AssignedIdentifierEntity<SkinSnapshotRow.Key> {
    @Id
    private UUID skinSetRevisionId;

    private UUID heroId;

    @Id
    private String skinKey;

    private int displayOrder;

    private UUID artAssetId;

    private String rarityCode;

    private UUID headAssetId;

    private UUID portraitAssetId;

    @Override
    public Key getId() {
        return new Key(skinSetRevisionId, skinKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skinSetRevisionId;
        public String skinKey;
    }
}
