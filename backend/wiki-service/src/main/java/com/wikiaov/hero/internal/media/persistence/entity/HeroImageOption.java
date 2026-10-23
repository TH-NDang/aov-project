package com.wikiaov.hero.internal.media.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(HeroImageOption.Key.class)
@Table(schema = "hero", name = "hero_image_option")
public class HeroImageOption extends AssignedIdentifierEntity<HeroImageOption.Key> {
    @Id
    private UUID mediaBindingRevisionId;
    @Id
    private String mediaRole;
    @Id
    private int imageOrder;
    private UUID assetId;
    private String label;

    @Override
    public Key getId() {
        return new Key(mediaBindingRevisionId, mediaRole, imageOrder);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID mediaBindingRevisionId;
        public String mediaRole;
        public int imageOrder;
    }
}
