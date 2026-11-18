package com.wikiaov.hero.internal.badges.persistence.entity;

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
