package com.wikiaov.hero.internal.skills.persistence.entity;

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
@Table(schema = "hero", name = "hero_skill_translation")
@IdClass(SkillTranslationRow.Key.class)
public class SkillTranslationRow extends AssignedIdentifierEntity<SkillTranslationRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String skillKey;

    @Id
    private String locale;

    private String name;

    private String description;

    private String summary;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public String locale;
    }
}
