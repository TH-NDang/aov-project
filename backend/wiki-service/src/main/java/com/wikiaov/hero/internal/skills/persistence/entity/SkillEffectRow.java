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
@Table(schema = "hero", name = "hero_skill_effect")
@IdClass(SkillEffectRow.Key.class)
public class SkillEffectRow extends AssignedIdentifierEntity<SkillEffectRow.Key> {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String skillKey;

    @Id
    private int effectOrder;

    private String effectType;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private java.util.Map<String, Object> metadata;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey, effectOrder);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public int effectOrder;
    }
}
