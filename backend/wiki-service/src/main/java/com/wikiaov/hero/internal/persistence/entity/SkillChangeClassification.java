package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_skill_change")
public class SkillChangeClassification extends HeroChangeClassification {
}
