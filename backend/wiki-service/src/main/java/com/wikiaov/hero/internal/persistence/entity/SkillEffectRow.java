package com.wikiaov.hero.internal.persistence.entity;

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
public class SkillEffectRow {
    @Id
    private UUID skillSetRevisionId;

    @Id
    private String skillKey;

    @Id
    private int effectOrder;

    private String effectType;

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    private java.util.Map<String, Object> metadata;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID skillSetRevisionId;
        public String skillKey;
        public int effectOrder;
    }
}
