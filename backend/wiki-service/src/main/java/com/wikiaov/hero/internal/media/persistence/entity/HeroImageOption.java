package com.wikiaov.hero.internal.media.persistence.entity;

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
