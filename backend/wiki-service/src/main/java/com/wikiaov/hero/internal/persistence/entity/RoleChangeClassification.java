package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;

@Entity
@Table(schema = "hero", name = "hero_role_change")
public class RoleChangeClassification extends HeroChangeClassification {
}
