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
@IdClass(SkinImageOption.Key.class)
@Table(schema = "hero", name = "skin_image_option")
public class SkinImageOption extends AssignedIdentifierEntity<SkinImageOption.Key> {
    @Id
    private UUID skinSetRevisionId;
    @Id
    private String skinKey;
    @Id
    private String mediaRole;
    @Id
    private int imageOrder;
    private UUID assetId;
    private String label;

    @Override
    public Key getId() {
        return new Key(skinSetRevisionId, skinKey, mediaRole, imageOrder);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skinSetRevisionId;
        public String skinKey;
        public String mediaRole;
        public int imageOrder;
    }
}
