package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.*;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(schema = "hero", name = "hero_combat_stat_value")
@IdClass(StatRow.Key.class)
public class StatRow {
    @Id
    private UUID statsRevisionId;

    @Id
    private String statKey;

    private BigDecimal baseValue;

    private BigDecimal growthPerLevel;

    private String unitCode;

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID statsRevisionId;
        public String statKey;
    }
}
