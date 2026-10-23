package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

import jakarta.persistence.*;
import java.util.UUID;
import lombok.*;

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

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public String locale;
    }
}
