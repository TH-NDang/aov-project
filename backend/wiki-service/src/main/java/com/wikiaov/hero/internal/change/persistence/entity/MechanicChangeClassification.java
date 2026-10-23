package com.wikiaov.hero.internal.change.persistence.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Getter
@Setter
@Table(schema = "hero", name = "hero_mechanic_change")
public class MechanicChangeClassification extends HeroChangeClassification {
    private String mechanicKey;
    @Column(columnDefinition = "text")
    private String description;
}
