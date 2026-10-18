package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@IdClass(SkinBadgeTranslation.Key.class)
@Table(schema = "hero", name = "skin_badge_translation")
public class SkinBadgeTranslation {
    @Id
    private UUID badgeId;
    @Id
    private String locale;
    private String displayName;
    private UUID iconAssetId;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID badgeId;
        public String locale;
    }
}
