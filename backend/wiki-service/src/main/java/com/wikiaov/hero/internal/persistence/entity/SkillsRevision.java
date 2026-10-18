package com.wikiaov.hero.internal.persistence.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter
@Setter
@Table(schema = "hero", name = "hero_skill_set_revision")
public class SkillsRevision extends SectionRevision {
}
