package com.wikiaov.hero.internal.stats.persistence.entity;

import com.wikiaov.hero.internal.shared.persistence.entity.AssignedIdentifierEntity;

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
public class StatRow extends AssignedIdentifierEntity<StatRow.Key> {
    @Id
    private UUID statsRevisionId;

    @Id
    private String statKey;

    private BigDecimal baseValue;

    private BigDecimal growthPerLevel;

    private String unitCode;

    @Override
    public Key getId() {
        return new Key(statsRevisionId, statKey);
    }

    @NoArgsConstructor
    @AllArgsConstructor
    @EqualsAndHashCode
    public static class Key implements java.io.Serializable {
        public UUID statsRevisionId;
        public String statKey;
    }
}
