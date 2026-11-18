package com.wikiaov.hero.internal.change.persistence.entity;

import com.wikiaov.hero.internal.domain.HeroContent.Role;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
    @Enumerated(EnumType.STRING)
    private Role roleCode;
    private boolean added;
}
