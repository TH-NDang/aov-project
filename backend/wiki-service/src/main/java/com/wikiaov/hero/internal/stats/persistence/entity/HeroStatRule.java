package com.wikiaov.hero.internal.stats.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

/** What every hero shares for one stat, whatever the patch: its level 1 value, its rise per level and its cap. */
@Entity
@Getter
@Setter
@Table(schema = "hero", name = "stat_rule")
public class HeroStatRule {
    @Id
    private UUID id;
    private String statKey;
    private String unit;
    private BigDecimal baseValue;
    private BigDecimal percentValue;
    private BigDecimal growthPerLevel;
    private BigDecimal capValue;
    private String sourceUrl;
    private long version;
    private Instant updatedAt;
}
