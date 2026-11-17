package com.wikiaov.hero.internal.profile.persistence.entity;

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
@Table(schema = "hero", name = "hero_profile_translation")
@IdClass(ProfileTranslationRow.Key.class)
public class ProfileTranslationRow extends AssignedIdentifierEntity<ProfileTranslationRow.Key> {
    @Id
    private UUID profileRevisionId;

    @Id
    private String locale;

    private String name;

    private String title;

    private String summary;

    private String lore;

    private String strengths;

    private String weaknesses;

    private String counterTips;

    @Override
    public Key getId() {
        return new Key(profileRevisionId, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID profileRevisionId;
        public String locale;
    }
}
