package com.wikiaov.hero.internal.persistence.entity;

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
public class HeroImageOption {
    @Id
    private UUID mediaBindingRevisionId;
    @Id
    private String mediaRole;
    @Id
    private int imageOrder;
    private UUID assetId;
    private String label;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID mediaBindingRevisionId;
        public String mediaRole;
        public int imageOrder;
    }
}
