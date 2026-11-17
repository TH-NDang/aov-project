package com.wikiaov.hero.internal.skins.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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
