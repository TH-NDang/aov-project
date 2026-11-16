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
@Table(schema = "hero", name = "hero_skill_trait_skill")
@IdClass(SkillTraitSkillRow.Key.class)
public class SkillTraitSkillRow extends AssignedIdentifierEntity<SkillTraitSkillRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String traitCode;

    @Id
    private String skillKey;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, traitCode, skillKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String traitCode;
        public String skillKey;
    }
}
