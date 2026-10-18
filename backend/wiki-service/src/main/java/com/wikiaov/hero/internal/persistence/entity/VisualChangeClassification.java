package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_visual_change")
public class VisualChangeClassification extends HeroChangeClassification {
}
