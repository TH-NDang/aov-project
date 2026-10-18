package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_stat_change")
public class StatChangeClassification extends HeroChangeClassification {
}
