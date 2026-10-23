package com.wikiaov.hero.internal.change.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Getter
@Setter
@Table(schema = "hero", name = "hero_stat_change")
public class StatChangeClassification extends HeroChangeClassification {
    private BigDecimal oldValue;
    private BigDecimal newValue;
    private String statKey;
    private String unitCode;
}
