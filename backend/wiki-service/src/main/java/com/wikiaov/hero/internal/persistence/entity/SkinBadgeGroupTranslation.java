package com.wikiaov.hero.internal.persistence.entity;

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
public class SkinBadgeGroupTranslation {
    @Id
    private UUID groupId;
    @Id
    private String locale;
    private String displayName;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID groupId;
        public String locale;
    }
}
