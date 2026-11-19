package com.wikiaov.hero.internal.skills.persistence.entity;

import com.wikiaov.platform.AssignedIdentifierEntity;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;
import java.util.Map;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

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

    @JdbcTypeCode(SqlTypes.JSON)
    private Map<String, Object> metadata;

    @Override
    public Key getId() {
        return new Key(skillSetRevisionId, skillKey, effectOrder);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public int effectOrder;
    }
}
