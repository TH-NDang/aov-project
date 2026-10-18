package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_mechanic_change")
public class MechanicChangeClassification extends HeroChangeClassification {
}
