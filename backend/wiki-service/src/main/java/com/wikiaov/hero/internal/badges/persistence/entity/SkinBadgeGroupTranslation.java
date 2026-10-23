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
@IdClass(SkinBadgeGroupTranslation.Key.class)
@Table(schema = "hero", name = "skin_badge_group_translation")
public class SkinBadgeGroupTranslation extends AssignedIdentifierEntity<SkinBadgeGroupTranslation.Key> {
    @Id
    private UUID groupId;
    @Id
    private String locale;
    private String displayName;

    @Override
    public Key getId() {
        return new Key(groupId, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID groupId;
        public String locale;
    }
}
