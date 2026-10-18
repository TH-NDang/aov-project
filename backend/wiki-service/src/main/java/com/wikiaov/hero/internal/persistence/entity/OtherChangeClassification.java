package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_other_change")
public class OtherChangeClassification extends HeroChangeClassification {
}
