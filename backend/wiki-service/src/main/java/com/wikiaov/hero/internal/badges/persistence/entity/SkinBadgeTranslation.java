package com.wikiaov.hero.internal.badges.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

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
public class SkinBadgeTranslation extends AssignedIdentifierEntity<SkinBadgeTranslation.Key> {
    @Id
    private UUID badgeId;
    @Id
    private String locale;
    private String displayName;
    private UUID iconAssetId;

    @Override
    public Key getId() {
        return new Key(badgeId, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID badgeId;
        public String locale;
    }
}
