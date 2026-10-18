package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_profile_translation")
@IdClass(ProfileTranslationRow.Key.class)
public class ProfileTranslationRow {
    @Id
    private UUID profileRevisionId;

    @Id
    private String locale;

    private String name;

    private String title;

    private String summary;

    private String lore;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID profileRevisionId;
        public String locale;
    }
}
