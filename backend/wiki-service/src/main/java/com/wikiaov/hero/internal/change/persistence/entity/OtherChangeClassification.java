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
@Table(schema = "hero", name = "hero_other_change")
public class OtherChangeClassification extends HeroChangeClassification {
    @Column(columnDefinition = "text")
    private String description;
}
