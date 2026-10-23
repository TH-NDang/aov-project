package com.wikiaov.hero.internal.ratings.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import lombok.Getter;
import org.hibernate.annotations.Immutable;

@Entity
@Getter
@Immutable
@Table(schema = "hero", name = "rating_scale")
public class RatingScale {
    @Id
    private String code;
    private BigDecimal minValue;
    private BigDecimal maxValue;
    private String semantics;
}
