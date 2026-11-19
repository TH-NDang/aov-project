package com.wikiaov.hero.internal.ratings.persistence.entity;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_overview_rating_revision")
public class RatingRevision extends SectionRevision {
    private String scaleCode;
    private BigDecimal survivability;
    private BigDecimal attackDamage;
    private BigDecimal skillEffects;
    private BigDecimal difficulty;
    private boolean derived;
}
