package com.wikiaov.hero.internal.badges.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
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
    public static class Key implements Serializable {
        public UUID groupId;
        public String locale;
    }
}
