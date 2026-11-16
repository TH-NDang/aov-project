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
@Table(schema = "hero", name = "hero_skill_trait_translation")
@IdClass(SkillTraitTranslationRow.Key.class)
public class SkillTraitTranslationRow extends AssignedIdentifierEntity<SkillTraitTranslationRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String traitCode;

    @Id
    private String locale;

    private String detail;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, traitCode, locale);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String traitCode;
        public String locale;
    }
}
