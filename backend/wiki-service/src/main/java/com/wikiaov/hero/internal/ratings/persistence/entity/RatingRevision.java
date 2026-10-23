package com.wikiaov.hero.internal.ratings.persistence.entity;

import com.wikiaov.hero.internal.sections.persistence.entity.SectionRevision;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_overview_rating_revision")
public class RatingRevision extends SectionRevision {
    private String scaleCode;
    private java.math.BigDecimal survivability;
    private java.math.BigDecimal attackDamage;
    private java.math.BigDecimal skillEffects;
    private java.math.BigDecimal difficulty;
    private boolean derived;
}
