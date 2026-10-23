package com.wikiaov.hero.internal.change.persistence.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Getter
@Setter
@Table(schema = "hero", name = "hero_role_change")
public class RoleChangeClassification extends HeroChangeClassification {
    private String roleCode;
    private boolean added;
}
